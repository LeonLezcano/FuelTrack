/**
 * FuelTrack — Compartment Cistern Stock & Seal Witness Audit Engine
 * Motor #115 / #120 / #141 (AiAppFactory Standard)
 *
 * Administra camiones cisterna con múltiples compartimentos independientes:
 * - Control de precintos numerados en bocas de carga y válvulas de descarga.
 * - Validación fotográfica y lectura cruzada del contador mecánico/digital del caudalímetro.
 * - Bloqueo de descarga si un precinto se reporta violentado o discrepante con el remito de planta.
 */

export class CompartmentSealAuditorEngine {
  constructor() {
    this.trucks = [];
    this.deliveries = [];
  }

  registerTankTruck({ id, plate, brand, driverName, compartments = [] }) {
    if (!id || !plate || !driverName) {
      throw new Error('ID, patente del chasis y chofer asignado son obligatorios');
    }

    const truck = {
      id,
      plate: String(plate).toUpperCase().trim(),
      brand: brand || 'Scania P360',
      driverName,
      totalCapacityLiters: compartments.reduce((acc, c) => acc + Number(c.capacityLiters || 0), 0),
      compartments: compartments.map((c, idx) => ({
        index: idx + 1,
        code: c.code || `COMP-${idx + 1}`,
        capacityLiters: Number(c.capacityLiters) || 0,
        currentFuelCode: c.currentFuelCode || 'DIESEL_500',
        currentVolumeLiters: Number(c.currentVolumeLiters) || 0,
        currentSealCode: c.currentSealCode || null,
        isDischarged: c.currentVolumeLiters === 0
      }))
    };

    this.trucks.push(truck);
    return truck;
  }

  auditAndDischargeFuel({
    truckId,
    compartmentIndex,
    clientName,
    clientLocation,
    expectedSealCode,
    inspectedSealCode,
    isSealIntact,
    counterBeforeLiters,
    counterAfterLiters,
    deliveredVolumeLiters,
    fuelTempCelsius = 15.0,
    flowmeterPhotoUrl = 'data:image/svg+xml;base64,mock'
  }) {
    const truck = this.trucks.find((t) => t.id === truckId);
    if (!truck) throw new Error('Camión cisterna no encontrado.');

    const comp = truck.compartments.find((c) => c.index === compartmentIndex);
    if (!comp) throw new Error(`Compartimento #${compartmentIndex} no existe en este camión.`);

    if (comp.currentVolumeLiters <= 0) {
      throw new Error(`El compartimento #${compartmentIndex} ya se encuentra vacío.`);
    }

    const errors = [];
    const warnings = [];

    // 1. Auditoría de Precinto de Seguridad
    if (!isSealIntact) {
      errors.push('ALERTA DE SEGURIDAD: El precinto de la cisterna fue reportado roto o violentado.');
    }
    if (expectedSealCode && inspectedSealCode && expectedSealCode !== inspectedSealCode) {
      errors.push(`Discrepancia de Precinto: Esperado '${expectedSealCode}' vs Observado '${inspectedSealCode}'.`);
    }

    // 2. Auditoría del Totalizador / Caudalímetro
    const counterDiff = Number((counterAfterLiters - counterBeforeLiters).toFixed(2));
    if (counterDiff <= 0) {
      errors.push('Lectura inválida del caudalímetro: El totalizador final no avanzó respecto al inicial.');
    }

    const deliveryDelta = Math.abs(counterDiff - deliveredVolumeLiters);
    if (deliveryDelta > 5.0) {
      warnings.push(`Diferencia de ${deliveryDelta} L entre lo facturado (${deliveredVolumeLiters} L) y el cuentavueltas (${counterDiff} L).`);
    }

    if (deliveredVolumeLiters > comp.currentVolumeLiters) {
      errors.push(`Volumen entregado (${deliveredVolumeLiters} L) supera el saldo disponible en compartimento (${comp.currentVolumeLiters} L).`);
    }

    const isApproved = errors.length === 0;

    if (isApproved) {
      comp.currentVolumeLiters = Number((comp.currentVolumeLiters - deliveredVolumeLiters).toFixed(2));
      comp.isDischarged = comp.currentVolumeLiters === 0;
      comp.currentSealCode = null; // Precinto destruido en descarga
    }

    const deliveryRecord = {
      id: `DELIV-${Date.now().toString(36).toUpperCase()}`,
      truckId,
      truckPlate: truck.plate,
      driverName: truck.driverName,
      compartmentIndex,
      clientName,
      clientLocation,
      fuelTypeCode: comp.currentFuelCode,
      deliveredVolumeLiters: Number(deliveredVolumeLiters),
      counterBeforeLiters,
      counterAfterLiters,
      counterDiffLiters: counterDiff,
      fuelTempCelsius,
      flowmeterPhotoUrl,
      expectedSealCode,
      inspectedSealCode,
      isSealIntact,
      isApproved,
      status: isApproved ? 'ENTREGA_CONFORME' : 'BLOQUEADO_ANOMALIA',
      errors,
      warnings,
      dischargedAt: new Date().toISOString()
    };

    this.deliveries.push(deliveryRecord);
    return deliveryRecord;
  }

  getTruck(id) {
    return this.trucks.find((t) => t.id === id) || null;
  }

  getDeliveries() {
    return this.deliveries;
  }
}
