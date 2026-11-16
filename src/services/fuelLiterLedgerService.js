/**
 * FuelTrack — Commodity Liter Ledger & ICL/IDC Fiscal Breakdown Service
 * Motor #161 / #107 (AiAppFactory Standard)
 *
 * Administra cuentas corrientes pactadas en LITROS FÍSICOS de combustible y el desglose impositivo argentino:
 * 1. Precio de Pizarra YPF / Shell de referencia (ARS por litro).
 * 2. Desglose impositivo según Ley 23.966:
 *    - Precio Neto Gravado
 *    - Impuesto al Valor Agregado (IVA 21%)
 *    - Impuesto a los Combustibles Líquidos (ICL - Monto Fijo/Litro)
 *    - Impuesto al Dióxido de Carbono (IDC - Monto Fijo/Litro)
 * 3. Liquidación de Cuentas Corrientes en Litros: Permite que un productor agropecuario pague por adelantado 10.000 L de Gasoil y los retire contra entrega en cualquier momento sin exposición a la devaluación del peso.
 */

export class FuelLiterLedgerService {
  constructor() {
    this.accounts = new Map(); // clientId -> { clientName, balanceLiters: { DIESEL_500, EURO_DIESEL }, movements: [] }
  }

  getAccount(clientId, clientName = 'Cliente') {
    if (!this.accounts.has(clientId)) {
      this.accounts.set(clientId, {
        clientId,
        clientName,
        balancesLiters: {
          DIESEL_500: 0,
          EURO_DIESEL: 0,
          NAFTA_SUPER: 0
        },
        movements: []
      });
    }
    return this.accounts.get(clientId);
  }

  creditLiters({ clientId, clientName, fuelTypeCode = 'DIESEL_500', liters, pricePerLiterARS, receiptNumber }) {
    const acc = this.getAccount(clientId, clientName);
    const qty = Math.max(0, Number(liters) || 0);
    const price = Number(pricePerLiterARS) || 1200;

    acc.balancesLiters[fuelTypeCode] = Number(((acc.balancesLiters[fuelTypeCode] || 0) + qty).toFixed(2));

    const mov = {
      id: `MOV-CR-${Date.now().toString(36).toUpperCase()}`,
      type: 'ACREDITACION_PAGO_ANTICIPADO',
      fuelTypeCode,
      liters: qty,
      pricePerLiterARS: price,
      totalAmountARS: Number((qty * price).toFixed(2)),
      balanceAfterLiters: acc.balancesLiters[fuelTypeCode],
      receiptNumber: receiptNumber || 'REC-001',
      timestamp: new Date().toISOString()
    };

    acc.movements.push(mov);
    return { account: acc, movement: mov };
  }

  debitDeliveryLiters({ clientId, clientName, fuelTypeCode = 'DIESEL_500', liters, deliveryId }) {
    const acc = this.getAccount(clientId, clientName);
    const qty = Math.max(0, Number(liters) || 0);

    acc.balancesLiters[fuelTypeCode] = Number(((acc.balancesLiters[fuelTypeCode] || 0) - qty).toFixed(2));

    const mov = {
      id: `MOV-DB-${Date.now().toString(36).toUpperCase()}`,
      type: 'DESCARGA_COMBUSTIBLE_REMITO',
      fuelTypeCode,
      liters: -qty,
      deliveryId,
      balanceAfterLiters: acc.balancesLiters[fuelTypeCode],
      timestamp: new Date().toISOString()
    };

    acc.movements.push(mov);
    return { account: acc, movement: mov };
  }

  /**
   * Calcula el desglose impositivo argentino (Neto + IVA 21% + ICL + IDC)
   * @param {Object} params
   * @param {number} params.liters
   * @param {number} params.retailPricePerLiterARS - Precio final surtidor por litro
   * @param {number} [params.iclFixedPerLiter=145.20] - Impuesto a Combustibles Líquidos
   * @param {number} [params.idcFixedPerLiter=8.90]   - Impuesto al Dióxido de Carbono
   */
  static computeArgentineTaxBreakdown({
    liters,
    retailPricePerLiterARS,
    iclFixedPerLiter = 145.20,
    idcFixedPerLiter = 8.90
  }) {
    const qty = Math.max(0, Number(liters) || 0);
    const retailPrice = Number(retailPricePerLiterARS) || 1200;

    const totalGross = Number((qty * retailPrice).toFixed(2));
    const totalICL = Number((qty * iclFixedPerLiter).toFixed(2));
    const totalIDC = Number((qty * idcFixedPerLiter).toFixed(2));
    const totalSpecificTaxes = totalICL + totalIDC;

    // Base imponible gravada por IVA (Total menos ICL e IDC) / 1.21
    const baseGravadaConIVA = Math.max(0, totalGross - totalSpecificTaxes);
    const netoGravado = Number((baseGravadaConIVA / 1.21).toFixed(2));
    const iva21 = Number((netoGravado * 0.21).toFixed(2));

    return {
      liters: qty,
      retailPricePerLiterARS: retailPrice,
      netoGravadoARS: netoGravado,
      iva21ARS: iva21,
      iclTotalARS: totalICL,
      idcTotalARS: totalIDC,
      totalTaxesARS: Number((iva21 + totalICL + totalIDC).toFixed(2)),
      grandTotalARS: totalGross
    };
  }
}
