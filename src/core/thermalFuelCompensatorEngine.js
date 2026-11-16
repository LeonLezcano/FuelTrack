/**
 * FuelTrack — Thermal Volume Compensation Engine (15°C Standard)
 * Motor #307 (AiAppFactory Standard)
 *
 * Resuelve las mermas físicas por temperatura en combustibles líquidos (ASTM Table 54B / Res. SE 1102/04):
 * Fórmula de corrección estándar:
 * V_15 = V_T * [1 - alpha * (T - 15)]
 * Donde:
 * - V_T: Volumen medido a temperatura ambiente por el caudalímetro.
 * - alpha: Coeficiente de dilatación térmica cúbica del hidrocarburo (1/°C).
 *   * Gasoil Grado 2 / Grado 3: ~0.00083 / °C
 *   * Nafta Super / Premium:   ~0.00120 / °C
 *   * Kerosene / JP-1:         ~0.00095 / °C
 */

export const FUEL_TYPES = {
  DIESEL_500: {
    code: 'DIESEL_500',
    name: 'Gasoil Grado 2 (Ultra Diesel 500)',
    alpha: 0.00083,
    densityAt15: 0.845 // kg/L
  },
  EURO_DIESEL: {
    code: 'EURO_DIESEL',
    name: 'Gasoil Grado 3 (Infinia Diesel / V-Power)',
    alpha: 0.00083,
    densityAt15: 0.835
  },
  NAFTA_SUPER: {
    code: 'NAFTA_SUPER',
    name: 'Nafta Súper 95 Octanos',
    alpha: 0.00120,
    densityAt15: 0.745
  },
  NAFTA_PREMIUM: {
    code: 'NAFTA_PREMIUM',
    name: 'Nafta Premium 98 Octanos',
    alpha: 0.00122,
    densityAt15: 0.750
  }
};

export class ThermalFuelCompensatorEngine {
  /**
   * Calcula el volumen compensado a 15°C estándar
   * @param {Object} params
   * @param {number} params.observedVolumeLiters - Litros leídos en surtidor/caudalímetro
   * @param {number} params.observedTempCelsius - Temperatura en boca de tanque (°C)
   * @param {string} [params.fuelTypeCode='DIESEL_500']
   * @returns {Object} { observedVolume, compensatedVolume15C, deltaLiters, expansionFactor, density }
   */
  static computeVolume15C({ observedVolumeLiters, observedTempCelsius, fuelTypeCode = 'DIESEL_500' }) {
    const vObs = Math.max(0, Number(observedVolumeLiters) || 0);
    const temp = Number(observedTempCelsius);
    if (!Number.isFinite(temp)) {
      throw new Error('La temperatura observada debe ser un valor numérico válido.');
    }

    const fuel = FUEL_TYPES[fuelTypeCode] || FUEL_TYPES.DIESEL_500;
    const alpha = fuel.alpha;

    // Factor de corrección volumétrica VCF
    // VCF = 1 - alpha * (T - 15)
    const deltaT = temp - 15.0;
    const vcf = 1.0 - alpha * deltaT;

    // V_15 = V_Obs * VCF
    const v15 = Number((vObs * vcf).toFixed(2));
    const deltaLiters = Number((v15 - vObs).toFixed(2));

    return {
      fuelTypeCode,
      fuelName: fuel.name,
      observedVolumeLiters: vObs,
      observedTempCelsius: temp,
      compensatedVolume15C: v15,
      deltaLiters, // Positivo si T < 15°C (el combustible se había contraído), Negativo si T > 15°C (dilatado)
      vcf: Number(vcf.toFixed(5)),
      standardTemp: 15.0
    };
  }

  /**
   * Audita si una discrepancia en descarga excede la tolerancia legal/térmica (0.3% max merma admisible)
   * @param {Object} params
   * @param {number} params.loadedVolumeLiters - Litros cargados en planta/refinería
   * @param {number} params.deliveredVolumeLiters - Litros entregados en destino
   * @param {number} params.loadedTempCelsius
   * @param {number} params.deliveredTempCelsius
   * @param {string} [params.fuelTypeCode='DIESEL_500']
   * @returns {Object}
   */
  static auditTransportLoss({
    loadedVolumeLiters,
    deliveredVolumeLiters,
    loadedTempCelsius,
    deliveredTempCelsius,
    fuelTypeCode = 'DIESEL_500'
  }) {
    const loaded15 = this.computeVolume15C({
      observedVolumeLiters: loadedVolumeLiters,
      observedTempCelsius: loadedTempCelsius,
      fuelTypeCode
    });

    const delivered15 = this.computeVolume15C({
      observedVolumeLiters: deliveredVolumeLiters,
      observedTempCelsius: deliveredTempCelsius,
      fuelTypeCode
    });

    const rawDiffLiters = deliveredVolumeLiters - loadedVolumeLiters;
    const realLossLiters15C = Number((delivered15.compensatedVolume15C - loaded15.compensatedVolume15C).toFixed(2));
    const allowedToleranceLiters = Number((loaded15.compensatedVolume15C * 0.003).toFixed(2)); // 0.3% tolerancia IRAM/SE

    const isSuspiciousTheft = realLossLiters15C < -allowedToleranceLiters;

    return {
      loadedAt15C: loaded15.compensatedVolume15C,
      deliveredAt15C: delivered15.compensatedVolume15C,
      rawDiffLiters,
      realLossLiters15C,
      allowedToleranceLiters,
      isWithinTolerance: !isSuspiciousTheft,
      isSuspiciousTheft, // Alerta robo / ordeñe en ruta si supera el 0.3% a 15°C
      lossPercentage: Number(((realLossLiters15C / (loaded15.compensatedVolume15C || 1)) * 100).toFixed(3))
    };
  }
}
