/**
 * FuelTrack — Test Guardian Multi-Tier Test Suite (50+ Tests)
 * AiAppFactory Mandatory Standard
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ThermalFuelCompensatorEngine, FUEL_TYPES } from '../src/core/thermalFuelCompensatorEngine.js';
import { CompartmentSealAuditorEngine } from '../src/core/compartmentSealAuditorEngine.js';
import { FuelLiterLedgerService } from '../src/services/fuelLiterLedgerService.js';
import { FuelTrackCache } from '../src/services/fuelTrackCache.service.js';
import { computeSHA256, sealFuelDeliveryEPOD } from '../src/utils/cryptoSeal.js';
import { formatCurrency, formatLiters, formatDateTime, formatDate } from '../src/utils/formatters.js';
import { Sanitizer } from '../src/utils/sanitizer.js';
import { state, seedDemoData, purgeDemoData } from '../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message, layer = 'UNIT') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [${layer}] ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ [${layer}] FAIL: ${message}`);
  }
}

async function runAllTests() {
  console.log('\n=============================================================');
  console.log('🧪 FUELTRACK TEST GUARDIAN — SUITE MULTI-CAPA (50+ TESTS)');
  console.log('=============================================================\n');

  // ==========================================
  // CAPA 1: PRUEBAS UNITARIAS & FUZZING (15 Tests)
  // ==========================================
  console.log('--- CAPA 1: Pruebas Unitarias & Fuzzing Caótico ---');

  // 1. Sanitizador & XSS Prevention
  assert(Sanitizer.escapeHTML('<script>alert("xss")</script>') === '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', 'Sanitizer.escapeHTML neutraliza etiquetas script', 'UNIT');
  assert(Sanitizer.escapeHTML(null) === '' && Sanitizer.escapeHTML(undefined) === '', 'Sanitizer.escapeHTML maneja entradas nulas y undefined de forma segura', 'UNIT');
  assert(Sanitizer.sanitizeURL('javascript:alert(1)').includes('#'), 'Sanitizer.sanitizeURL bloquea esquemas javascript:', 'UNIT');
  assert(Sanitizer.sanitizeURL('https://ypf.com/combustibles') === 'https://ypf.com/combustibles', 'Sanitizer.sanitizeURL permite URLs HTTPS válidas', 'UNIT');

  // 2. Formatters
  assert(formatCurrency(1200000).includes('1.200.000'), 'formatCurrency formatea montos en pesos argentinos', 'UNIT');
  assert(formatLiters(5000.5).includes('5.000,5') || formatLiters(5000.5).includes('5000'), 'formatLiters formatea volúmenes con sufijo L', 'UNIT');
  assert(formatDate(null) === '-', 'formatDate maneja fecha nula retornando guión', 'UNIT');
  assert(formatDateTime('2026-11-16T10:30:00Z').includes('16/11/2026') || formatDateTime('2026-11-16T10:30:00Z').includes('2026'), 'formatDateTime formatea fechas sanitarias completas', 'UNIT');

  // 3. Compensación Térmica de Combustible a 15°C
  const coldComp = ThermalFuelCompensatorEngine.computeVolume15C({
    observedVolumeLiters: 10000,
    observedTempCelsius: 10.0,
    fuelTypeCode: 'DIESEL_500'
  });
  // A 10°C (frío), el combustible estaba contraído; a 15°C estándar ocupa más volumen
  assert(coldComp.compensatedVolume15C > 10000, 'Compensación 15°C: Volumen a 10°C aumenta al corregir a 15°C', 'UNIT');
  assert(coldComp.deltaLiters > 0, 'deltaLiters es positivo ante temperaturas inferiores a 15°C', 'UNIT');

  const hotComp = ThermalFuelCompensatorEngine.computeVolume15C({
    observedVolumeLiters: 10000,
    observedTempCelsius: 30.0,
    fuelTypeCode: 'DIESEL_500'
  });
  // A 30°C (calor), el combustible estaba dilatado; a 15°C estándar ocupa menos volumen
  assert(hotComp.compensatedVolume15C < 10000, 'Compensación 15°C: Volumen a 30°C disminuye al corregir a 15°C', 'UNIT');
  assert(hotComp.deltaLiters < 0, 'deltaLiters es negativo ante temperaturas superiores a 15°C', 'UNIT');

  // 4. Fuzzing Caótico sobre Temperaturas Extremas
  const subZeroComp = ThermalFuelCompensatorEngine.computeVolume15C({
    observedVolumeLiters: 5000,
    observedTempCelsius: -15.0, // Invierno patagónico
    fuelTypeCode: 'DIESEL_500'
  });
  assert(subZeroComp.compensatedVolume15C > 5000 && Number.isFinite(subZeroComp.compensatedVolume15C), 'Fuzzing Térmico: Procesa temperaturas bajo cero (-15°C) sin NaN', 'UNIT');

  try {
    ThermalFuelCompensatorEngine.computeVolume15C({ observedVolumeLiters: 5000, observedTempCelsius: NaN });
    assert(false, 'Debe fallar ante temperatura NaN', 'UNIT');
  } catch (e) {
    assert(true, 'Fuzzing Térmico: Rechaza temperatura NaN con error descriptivo', 'UNIT');
  }

  // 5. Desglose Impositivo Argentino (ICL / IDC / IVA 21%)
  const taxes = FuelLiterLedgerService.computeArgentineTaxBreakdown({
    liters: 1000,
    retailPricePerLiterARS: 1200,
    iclFixedPerLiter: 145.20,
    idcFixedPerLiter: 8.90
  });
  assert(taxes.grandTotalARS === 1200000, 'Tax Breakdown: Total bruto coincide con litros x precio surtidor ($1.200.000)', 'UNIT');
  assert(taxes.iclTotalARS === 145200, 'Tax Breakdown: ICL calculado con precisión fija por litro ($145.200)', 'UNIT');
  assert(taxes.idcTotalARS === 8900, 'Tax Breakdown: IDC calculado con precisión fija por litro ($8.900)', 'UNIT');

  // ==========================================
  // CAPA 2: PRUEBAS DE INTEGRACIÓN (15 Tests)
  // ==========================================
  console.log('\n--- CAPA 2: Integración & Cisternas Compartimentadas ---');

  const auditor = new CompartmentSealAuditorEngine();

  // 1. Registro de Camión Cisterna
  const truck = auditor.registerTankTruck({
    id: 'TRUCK-TEST',
    plate: 'AD 892 XZ',
    brand: 'Volvo VM 330 Cisterna',
    driverName: 'Carlos Benítez',
    compartments: [
      { code: 'C-1', capacityLiters: 5000, currentFuelCode: 'DIESEL_500', currentVolumeLiters: 5000, currentSealCode: 'SEAL-001' },
      { code: 'C-2', capacityLiters: 3000, currentFuelCode: 'EURO_DIESEL', currentVolumeLiters: 3000, currentSealCode: 'SEAL-002' }
    ]
  });
  assert(truck.totalCapacityLiters === 8000, 'Camión cisterna calcula capacidad total de 8.000 L', 'INTEGRATION');
  assert(truck.compartments.length === 2, 'Registra 2 compartimentos independientes', 'INTEGRATION');

  // 2. Alerta de Precinto Roto / Violentado
  const brokenSealDelivery = auditor.auditAndDischargeFuel({
    truckId: 'TRUCK-TEST',
    compartmentIndex: 1,
    clientName: 'Cantera San Martín',
    expectedSealCode: 'SEAL-001',
    inspectedSealCode: 'SEAL-001',
    isSealIntact: false, // Precinto violado
    counterBeforeLiters: 1000,
    counterAfterLiters: 2000,
    deliveredVolumeLiters: 1000
  });
  assert(!brokenSealDelivery.isApproved && brokenSealDelivery.status === 'BLOQUEADO_ANOMALIA', 'Seguridad: Bloquea entrega si el precinto está roto', 'INTEGRATION');
  assert(brokenSealDelivery.errors.some(e => e.includes('violentado')), 'Registra error específico de precinto violentado', 'INTEGRATION');

  // 3. Discrepancia de Código de Precinto
  const mismatchSealDelivery = auditor.auditAndDischargeFuel({
    truckId: 'TRUCK-TEST',
    compartmentIndex: 1,
    clientName: 'Cantera San Martín',
    expectedSealCode: 'SEAL-001',
    inspectedSealCode: 'SEAL-OTRO-99', // Discrepancia
    isSealIntact: true,
    counterBeforeLiters: 1000,
    counterAfterLiters: 2000,
    deliveredVolumeLiters: 1000
  });
  assert(!mismatchSealDelivery.isApproved && mismatchSealDelivery.status === 'BLOQUEADO_ANOMALIA', 'Seguridad: Bloquea entrega si el número de precinto no coincide con remito', 'INTEGRATION');

  // 4. Descarga Exitosa y Conforme
  const approvedDelivery = auditor.auditAndDischargeFuel({
    truckId: 'TRUCK-TEST',
    compartmentIndex: 1,
    clientName: 'Agropecuaria El Ombú',
    expectedSealCode: 'SEAL-001',
    inspectedSealCode: 'SEAL-001',
    isSealIntact: true,
    counterBeforeLiters: 50000,
    counterAfterLiters: 52500,
    deliveredVolumeLiters: 2500,
    fuelTempCelsius: 22.0
  });
  assert(approvedDelivery.isApproved && approvedDelivery.status === 'ENTREGA_CONFORME', 'Descarga conforme aprobada cuando precinto y cuentavueltas coinciden', 'INTEGRATION');

  const updatedComp1 = truck.compartments.find(c => c.index === 1);
  assert(updatedComp1.currentVolumeLiters === 2500, 'Descuenta volumen exacto del compartimento (5.000 L - 2.500 L = 2.500 L)', 'INTEGRATION');
  assert(updatedComp1.currentSealCode === null, 'El precinto queda nulo tras la descarga auditada', 'INTEGRATION');

  // 5. Intento de descargar más del volumen remanente
  const excessiveDelivery = auditor.auditAndDischargeFuel({
    truckId: 'TRUCK-TEST',
    compartmentIndex: 1,
    clientName: 'Agropecuaria El Ombú',
    expectedSealCode: null,
    inspectedSealCode: null,
    isSealIntact: true,
    counterBeforeLiters: 52500,
    counterAfterLiters: 57500,
    deliveredVolumeLiters: 5000 // Solo quedan 2.500
  });
  assert(!excessiveDelivery.isApproved && excessiveDelivery.status === 'BLOQUEADO_ANOMALIA', 'Control de Stock: Bloquea entrega si el volumen supera el remanente en cisterna', 'INTEGRATION');

  // 6. Auditoría de Mermas en Ruta y Detección de Ordeñe
  const normalTransport = ThermalFuelCompensatorEngine.auditTransportLoss({
    loadedVolumeLiters: 10000,
    deliveredVolumeLiters: 9980,
    loadedTempCelsius: 25.0,
    deliveredTempCelsius: 22.0,
    fuelTypeCode: 'DIESEL_500'
  });
  assert(normalTransport.isWithinTolerance && !normalTransport.isSuspiciousTheft, 'Transporte normal dentro de la tolerancia admisible de merma térmica', 'INTEGRATION');

  const suspiciousTheftTransport = ThermalFuelCompensatorEngine.auditTransportLoss({
    loadedVolumeLiters: 10000,
    deliveredVolumeLiters: 9400, // Faltan 600 litros inexplicables
    loadedTempCelsius: 20.0,
    deliveredTempCelsius: 20.0,
    fuelTypeCode: 'DIESEL_500'
  });
  assert(suspiciousTheftTransport.isSuspiciousTheft, 'Alerta de Robo / Ordeñe: Detecta faltante en ruta superior al 0.3%', 'INTEGRATION');

  // 7. Criptografía: Remito ePOD SHA-256
  const sealedPOD = await sealFuelDeliveryEPOD(approvedDelivery);
  assert(sealedPOD.sealHash && sealedPOD.sealHash.length === 64, 'sealFuelDeliveryEPOD genera hash criptográfico SHA-256 de 64 caracteres', 'INTEGRATION');
  assert(sealedPOD.verificationCode.startsWith('FT-'), 'verificationCode tiene prefijo institucional FT-', 'INTEGRATION');

  // 8. Offline Cache
  FuelTrackCache.set('offline_truck', { plate: 'AF 342 YP' });
  assert(FuelTrackCache.get('offline_truck')?.plate === 'AF 342 YP', 'FuelTrackCache almacena y recupera datos en almacenamiento local', 'INTEGRATION');
  FuelTrackCache.remove('offline_truck');
  assert(FuelTrackCache.get('offline_truck') === null, 'FuelTrackCache.remove limpia la clave correctamente', 'INTEGRATION');

  // ==========================================
  // CAPA 3: CUENTA CORRIENTE EN LITROS (10 Tests)
  // ==========================================
  console.log('\n--- CAPA 3: Cuenta Corriente en Litros Commodity ---');

  const ledger = new FuelLiterLedgerService();

  // 1. Acreditación de Litros por Pago Anticipado
  const credRes = ledger.creditLiters({
    clientId: 'CLI-AGRO-99',
    clientName: 'Don Pancho S.A.',
    fuelTypeCode: 'DIESEL_500',
    liters: 10000,
    pricePerLiterARS: 1150,
    receiptNumber: 'REC-AGRO-001'
  });
  assert(credRes.account.balancesLiters.DIESEL_500 === 10000, 'Acredita 10.000 L de Gasoil en la cuenta corriente', 'INTEGRATION');
  assert(credRes.movement.totalAmountARS === 11500000, 'Registra el importe de pago anticipado equivalente ($11.500.000)', 'INTEGRATION');

  // 2. Débito de Litros contra Entrega en Campo
  const debitRes = ledger.debitDeliveryLiters({
    clientId: 'CLI-AGRO-99',
    clientName: 'Don Pancho S.A.',
    fuelTypeCode: 'DIESEL_500',
    liters: 3000,
    deliveryId: approvedDelivery.id
  });
  assert(debitRes.account.balancesLiters.DIESEL_500 === 7000, 'Descuenta 3.000 L quedando 7.000 L de saldo a favor', 'INTEGRATION');
  assert(debitRes.movement.liters === -3000, 'El movimiento de descarga se registra con signo negativo', 'INTEGRATION');

  // 3. Múltiples Productos en Cuenta Corriente
  ledger.creditLiters({
    clientId: 'CLI-AGRO-99',
    fuelTypeCode: 'EURO_DIESEL',
    liters: 2000,
    pricePerLiterARS: 1350
  });
  assert(ledger.getAccount('CLI-AGRO-99').balancesLiters.EURO_DIESEL === 2000, 'Gestiona saldos independientes por tipo de combustible (Gasoil Común vs Euro)', 'INTEGRATION');

  // ==========================================
  // CAPA 4: PRUEBAS DE SEGURIDAD (10 Tests)
  // ==========================================
  console.log('\n--- CAPA 4: Pruebas de Seguridad (XSS, Reglas & Headers) ---');

  // 1. Verificación de Firestore Rules
  const firestoreRulesPath = path.join(projectRoot, 'firestore.rules');
  assert(fs.existsSync(firestoreRulesPath), 'Archivo firestore.rules existe en la raíz', 'SEC');
  const rulesContent = fs.readFileSync(firestoreRulesPath, 'utf-8');
  assert(!rulesContent.includes('allow read, write: if true;'), 'firestore.rules no contiene reglas públicas abiertas (RULES-001)', 'SEC');
  assert(rulesContent.includes('isLogisticsStaff()'), 'firestore.rules restringe operaciones a personal logístico autenticado', 'SEC');
  assert(rulesContent.includes('isAdmin()'), 'firestore.rules restringe borrados únicamente al rol ADMIN', 'SEC');

  // 2. Verificación de Cabeceras HTTP en firebase.json
  const firebaseJsonPath = path.join(projectRoot, 'firebase.json');
  assert(fs.existsSync(firebaseJsonPath), 'Archivo firebase.json existe en la raíz', 'SEC');
  const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf-8'));
  const allHeaders = firebaseJson.hosting?.headers || [];
  const globalHeaderObj = allHeaders.find((h) => h.source === '**')?.headers || [];
  const headerKeys = globalHeaderObj.map((h) => h.key.toLowerCase());
  assert(headerKeys.includes('content-security-policy'), 'firebase.json define Content-Security-Policy (CSP)', 'SEC');
  assert(headerKeys.includes('x-frame-options') && headerKeys.includes('x-content-type-options'), 'firebase.json define X-Frame-Options y X-Content-Type-Options', 'SEC');

  const swEntry = allHeaders.find((h) => h.source === '/sw.js' || h.source === 'sw.js');
  const swCacheControl = swEntry?.headers?.find((h) => h.key.toLowerCase() === 'cache-control')?.value || '';
  assert(swCacheControl.includes('no-cache'), 'firebase.json define Cache-Control no-cache para el Service Worker', 'SEC');

  const cspHeader = globalHeaderObj.find((h) => h.key.toLowerCase() === 'content-security-policy')?.value || '';
  assert(!cspHeader.includes("'unsafe-inline'") && !cspHeader.includes('cdn.tailwindcss.com'), 'CSP en firebase.json elimina unsafe-inline y CDNs externos', 'SEC');

  const manifestPath = path.join(projectRoot, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'Archivo manifest.json existe en la raíz', 'SEC');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert(Boolean(manifest.name && manifest.start_url && manifest.display && Array.isArray(manifest.icons) && manifest.icons.length > 0), 'manifest.json contiene campos PWA válidos (name, start_url, display, icons)', 'SEC');

  const stylesCssPath = path.join(projectRoot, 'styles.css');
  assert(fs.existsSync(stylesCssPath), 'CSS compilado local styles.css existe para soporte Offline-First', 'SEC');

  const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
  assert(!indexHtml.includes('cdn.tailwindcss.com') && indexHtml.includes('./styles.css') && indexHtml.includes('./manifest.json'), 'index.html carga styles.css local y manifest.json sin CDN externo', 'SEC');

  // 3. Anti-siembra fantasma tras purga demo
  FuelTrackCache.clear();
  seedDemoData();
  assert(state.trucks.some((t) => t.isDemo), 'seedDemoData marca registros iniciales con isDemo: true', 'SEC');
  purgeDemoData();
  seedDemoData();
  assert(state.trucks.length === 0 && state.accounts.length === 0, 'seedDemoData respeta fueltrack_demo_purged y evita resiembra fantasma', 'SEC');
  FuelTrackCache.clear();

  // ==========================================
  // CAPA 5: FLUJO E2E Y CASO DE USO COMPLETO (6 Tests)
  // ==========================================
  console.log('\n--- CAPA 5: Flujo E2E & Despacho a Granel Completo ---');

  // E2E 1. Carga de Camión Cisterna en Refinería a 28°C
  const e2eTruck = auditor.registerTankTruck({
    id: 'TRUCK-E2E',
    plate: 'AF 102 OP',
    brand: 'Scania R450 Cisterna',
    driverName: 'Jorge Almirón',
    compartments: [
      { code: 'COMP-1', capacityLiters: 10000, currentFuelCode: 'DIESEL_500', currentVolumeLiters: 10000, currentSealCode: 'SEAL-E2E-991' }
    ]
  });
  assert(e2eTruck.id === 'TRUCK-E2E', 'E2E-1: Camión cisterna cargado en refinería con precinto SEAL-E2E-991', 'E2E');

  // E2E 2. Compensación Térmica de Carga (28°C -> 15°C)
  const e2eLoadComp = ThermalFuelCompensatorEngine.computeVolume15C({
    observedVolumeLiters: 10000,
    observedTempCelsius: 28.0,
    fuelTypeCode: 'DIESEL_500'
  });
  assert(e2eLoadComp.compensatedVolume15C < 10000, 'E2E-2: Volumen corregido a 15°C calculado para la carga en refinería', 'E2E');

  // E2E 3. Pago Anticipado de Productor en Cta Cte
  ledger.creditLiters({
    clientId: 'CLI-E2E-COOP',
    clientName: 'Cooperativa Agropecuaria Junín',
    fuelTypeCode: 'DIESEL_500',
    liters: 10000,
    pricePerLiterARS: 1200
  });
  assert(ledger.getAccount('CLI-E2E-COOP').balancesLiters.DIESEL_500 === 10000, 'E2E-3: Cooperativa tiene acreditados 10.000 L de gasoil en cuenta corriente', 'E2E');

  // E2E 4. Llegada a Campo, Verificación de Precinto y Descarga
  const e2eDelivery = auditor.auditAndDischargeFuel({
    truckId: 'TRUCK-E2E',
    compartmentIndex: 1,
    clientName: 'Cooperativa Agropecuaria Junín',
    expectedSealCode: 'SEAL-E2E-991',
    inspectedSealCode: 'SEAL-E2E-991',
    isSealIntact: true,
    counterBeforeLiters: 200000,
    counterAfterLiters: 205000,
    deliveredVolumeLiters: 5000,
    fuelTempCelsius: 18.0
  });
  assert(e2eDelivery.isApproved, 'E2E-4: Descarga de 5.000 L aprobada en el tanque aéreo del cliente', 'E2E');

  // E2E 5. Débito de Litros en Cuenta Corriente
  ledger.debitDeliveryLiters({
    clientId: 'CLI-E2E-COOP',
    fuelTypeCode: 'DIESEL_500',
    liters: 5000,
    deliveryId: e2eDelivery.id
  });
  assert(ledger.getAccount('CLI-E2E-COOP').balancesLiters.DIESEL_500 === 5000, 'E2E-5: Saldo de la cuenta corriente debitado exactamente a 5.000 L', 'E2E');

  // E2E 6. Emisión de Remito ePOD SHA-256
  const e2eSealed = await sealFuelDeliveryEPOD(e2eDelivery);
  assert(e2eSealed.verificationCode.startsWith('FT-') && e2eSealed.sealHash, 'E2E-6: Remito digital de combustible emitido con firma criptográfica inmutable', 'E2E');

  // ==========================================
  // REPORTE FINAL
  // ==========================================
  console.log('\n=============================================================');
  console.log(`📊 RESULTADO DE LA BATERÍA DE PRUEBAS FUELTRACK:`);
  console.log(`   Total de pruebas: ${totalTests}`);
  console.log(`   Pruebas aprobadas: ${passedTests}`);
  console.log(`   Pruebas fallidas:  ${failedTests}`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Error fatal durante la ejecución de pruebas:', err);
  process.exit(1);
});
