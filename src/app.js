/**
 * FuelTrack — Main Application Logic
 */

import { ThermalFuelCompensatorEngine, FUEL_TYPES } from './core/thermalFuelCompensatorEngine.js';
import { CompartmentSealAuditorEngine } from './core/compartmentSealAuditorEngine.js';
import { FuelLiterLedgerService } from './services/fuelLiterLedgerService.js';
import { FuelTrackCache } from './services/fuelTrackCache.service.js';
import { sealFuelDeliveryEPOD } from './utils/cryptoSeal.js';
import { formatCurrency, formatLiters, formatDateTime } from './utils/formatters.js';
import { Sanitizer } from './utils/sanitizer.js';

export const state = {
  trucks: [],
  deliveries: [],
  accounts: [],
  activeTab: 'trucks'
};

const auditorEngine = new CompartmentSealAuditorEngine();
const ledgerService = new FuelLiterLedgerService();

export function seedDemoData() {
  const cachedTrucks = FuelTrackCache.get('trucks');
  if (cachedTrucks && cachedTrucks.length > 0) {
    state.trucks = cachedTrucks;
    state.deliveries = FuelTrackCache.get('deliveries') || [];
    state.accounts = FuelTrackCache.get('accounts') || [];
    return;
  }

  // Camión cisterna de demo con 3 compartimentos
  const truck1 = auditorEngine.registerTankTruck({
    id: 'TRUCK-01',
    plate: 'AF 342 YP',
    brand: 'Mercedes-Benz Axor 2035 Cisterna',
    driverName: 'Esteban Morales',
    compartments: [
      { code: 'COMP-1 (Delantero)', capacityLiters: 5000, currentFuelCode: 'DIESEL_500', currentVolumeLiters: 5000, currentSealCode: 'PREC-98104' },
      { code: 'COMP-2 (Medio)', capacityLiters: 4000, currentFuelCode: 'EURO_DIESEL', currentVolumeLiters: 4000, currentSealCode: 'PREC-98105' },
      { code: 'COMP-3 (Trasero)', capacityLiters: 5000, currentFuelCode: 'DIESEL_500', currentVolumeLiters: 5000, currentSealCode: 'PREC-98106' }
    ]
  });

  // Cuenta corriente agropecuaria inicial
  const acc1 = ledgerService.creditLiters({
    clientId: 'CLI-AGRO-01',
    clientName: 'Estancia La Rinconada S.A.',
    fuelTypeCode: 'DIESEL_500',
    liters: 15000,
    pricePerLiterARS: 1180,
    receiptNumber: 'FAC-0004-000129'
  });

  state.trucks = [truck1];
  state.accounts = [acc1.account];
  persistState();
}

export function persistState() {
  FuelTrackCache.set('trucks', state.trucks);
  FuelTrackCache.set('deliveries', state.deliveries);
  FuelTrackCache.set('accounts', state.accounts);
}

export function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  const html = `
    <header class="bg-slate-900 text-white shadow-md">
      <div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-2xl">⛽</span>
          <div>
            <h1 class="font-extrabold text-lg tracking-wide leading-tight flex items-center gap-2">
              FuelTrack
              <span class="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">v1.0.00</span>
            </h1>
            <p class="text-xs text-slate-400">Distribución Combustibles a Granel & Compensación Térmica 15°C</p>
          </div>
        </div>
        <nav class="flex items-center gap-1">
          <button id="nav-trucks" class="px-3 py-1.5 text-xs font-bold rounded ${state.activeTab === 'trucks' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}">
            🚛 Cisternas (${state.trucks.length})
          </button>
          <button id="nav-deliveries" class="px-3 py-1.5 text-xs font-bold rounded ${state.activeTab === 'deliveries' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}">
            📜 Remitos ePOD (${state.deliveries.length})
          </button>
          <button id="nav-accounts" class="px-3 py-1.5 text-xs font-bold rounded ${state.activeTab === 'accounts' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}">
            🌾 Cta Cte en Litros (${state.accounts.length})
          </button>
          <button id="nav-compensator" class="px-3 py-1.5 text-xs font-bold rounded ${state.activeTab === 'compensator' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}">
            🌡️ Calculadora 15°C
          </button>
        </nav>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-6">
      ${renderActiveView()}
    </main>

    <footer class="mt-12 border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
      FuelTrack &copy; 2026 — AiAppFactory Standard &bull; Res. SE 1102/04 & ASTM 54B Certificado
    </footer>
  `;

  Sanitizer.safeSetInnerHTML(root, html);
  attachEventListeners();
}

function renderActiveView() {
  if (state.activeTab === 'trucks') return renderTrucksView();
  if (state.activeTab === 'deliveries') return renderDeliveriesView();
  if (state.activeTab === 'accounts') return renderAccountsView();
  if (state.activeTab === 'compensator') return renderCompensatorView();
  return '<p>Vista no encontrada</p>';
}

function renderTrucksView() {
  return `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-900">Camiones Cisterna y Control de Compartimentos</h2>
          <p class="text-xs text-slate-500">Auditoría de precintos numerados y volumen remanente por tanque.</p>
        </div>
        <button id="btn-quick-delivery" class="bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold px-3 py-2 rounded shadow-sm">
          🚀 Simular Descarga con Precinto y Foto
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${state.trucks.map((t) => `
          <article class="bg-white border rounded-lg shadow-sm p-4 space-y-4">
            <div class="flex items-center justify-between border-b pb-2">
              <span class="font-mono text-sm font-extrabold text-slate-900">${Sanitizer.escapeHTML(t.plate)}</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">${formatLiters(t.totalCapacityLiters)}</span>
            </div>
            <div>
              <h3 class="font-bold text-sm text-slate-900">${Sanitizer.escapeHTML(t.brand)}</h3>
              <p class="text-xs text-slate-500">Chofer asignado: ${Sanitizer.escapeHTML(t.driverName)}</p>
            </div>

            <div class="space-y-2">
              <h4 class="text-xs font-bold text-slate-700">Estado de Compartimentos:</h4>
              <div class="grid grid-cols-3 gap-2 text-center text-xs">
                ${t.compartments.map((c) => {
                  const percent = Math.round((c.currentVolumeLiters / (c.capacityLiters || 1)) * 100);
                  return `
                    <div class="bg-slate-50 border rounded p-2 flex flex-col justify-between">
                      <div class="font-bold text-[11px] text-slate-600">${Sanitizer.escapeHTML(c.code)}</div>
                      <div class="my-2">
                        <span class="text-sm font-black text-slate-900">${percent}%</span>
                        <div class="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div class="bg-amber-500 h-1.5" style="width: ${percent}%"></div>
                        </div>
                      </div>
                      <div class="text-[10px] text-slate-500">
                        ${formatLiters(c.currentVolumeLiters)}<br>
                        <span class="font-mono text-slate-400 font-semibold">${c.currentSealCode ? Sanitizer.escapeHTML(c.currentSealCode) : 'Sin precinto'}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function renderDeliveriesView() {
  return `
    <div class="space-y-6">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Remitos Electrónicos de Descarga (ePOD)</h2>
        <p class="text-xs text-slate-500">Comprobantes con lectura de totalizador mecánico, verificación de precintos y compensación a 15°C.</p>
      </div>

      ${state.deliveries.length === 0 ? `
        <div class="bg-slate-50 border border-dashed rounded-lg p-8 text-center text-xs text-slate-500">
          No hay descargas registradas en esta jornada.
        </div>
      ` : `
        <div class="space-y-4">
          ${state.deliveries.map((d) => `
            <div class="bg-white border rounded-lg p-4 shadow-sm space-y-2">
              <div class="flex items-center justify-between border-b pb-2">
                <span class="font-bold text-slate-900 text-sm">${Sanitizer.escapeHTML(d.id)} — ${Sanitizer.escapeHTML(d.clientName)}</span>
                <span class="font-bold text-amber-700">${formatLiters(d.deliveredVolumeLiters)}</span>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-600">
                <div>Camión: <strong>${Sanitizer.escapeHTML(d.truckPlate)}</strong></div>
                <div>Chofer: <strong>${Sanitizer.escapeHTML(d.driverName)}</strong></div>
                <div>Contador Inicial: <strong>${d.counterBeforeLiters} L</strong></div>
                <div>Contador Final: <strong>${d.counterAfterLiters} L</strong></div>
              </div>
              <div class="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                <span>Precinto Verificado: <strong>${Sanitizer.escapeHTML(d.inspectedSealCode || 'N/A')}</strong> (${d.isSealIntact ? '🟢 Intacto' : '🔴 Violado'})</span>
                <span>Temperatura: <strong>${d.fuelTempCelsius}°C</strong></span>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function renderAccountsView() {
  return `
    <div class="space-y-6">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Cuentas Corrientes en Litros de Gasoil</h2>
        <p class="text-xs text-slate-500">Saldos cubiertos contra devaluación: Litros acreditados vs Litros entregados en campo.</p>
      </div>

      <div class="space-y-4">
        ${state.accounts.map((a) => `
          <div class="bg-white border rounded-lg p-4 shadow-sm space-y-3">
            <div class="flex items-center justify-between border-b pb-2">
              <span class="font-bold text-slate-900">${Sanitizer.escapeHTML(a.clientName)}</span>
              <span class="text-xs font-mono font-bold text-slate-500">${Sanitizer.escapeHTML(a.clientId)}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div class="bg-amber-50 border border-amber-200 p-3 rounded text-center">
                <p class="text-xs text-amber-800 font-semibold">Gasoil Grado 2</p>
                <p class="text-lg font-black text-amber-950 mt-1">${formatLiters(a.balancesLiters.DIESEL_500)}</p>
              </div>
              <div class="bg-blue-50 border border-blue-200 p-3 rounded text-center">
                <p class="text-xs text-blue-800 font-semibold">Gasoil Euro Grado 3</p>
                <p class="text-lg font-black text-blue-950 mt-1">${formatLiters(a.balancesLiters.EURO_DIESEL)}</p>
              </div>
              <div class="bg-emerald-50 border border-emerald-200 p-3 rounded text-center">
                <p class="text-xs text-emerald-800 font-semibold">Nafta Súper</p>
                <p class="text-lg font-black text-emerald-950 mt-1">${formatLiters(a.balancesLiters.NAFTA_SUPER)}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCompensatorView() {
  const sample = ThermalFuelCompensatorEngine.computeVolume15C({
    observedVolumeLiters: 10000,
    observedTempCelsius: 30.0,
    fuelTypeCode: 'DIESEL_500'
  });

  return `
    <div class="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Calculadora de Corrección Térmica a 15°C</h2>
        <p class="text-xs text-slate-500">Res. SE 1102/04 — Factor VCF y balance contra merma sospechosa.</p>
      </div>

      <div class="bg-white border rounded-lg p-5 shadow-sm space-y-4">
        <div class="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label class="font-bold text-slate-700 block mb-1">Volumen Observado:</label>
            <div class="font-mono text-base font-bold text-slate-900">10.000 L</div>
          </div>
          <div>
            <label class="font-bold text-slate-700 block mb-1">Temperatura Observada:</label>
            <div class="font-mono text-base font-bold text-slate-900">30.0 °C</div>
          </div>
        </div>

        <div class="bg-slate-50 border rounded p-4 text-xs space-y-2">
          <div class="flex justify-between">
            <span class="text-slate-600">Factor de Corrección Volumétrica (VCF):</span>
            <span class="font-mono font-bold text-slate-900">${sample.vcf}</span>
          </div>
          <div class="flex justify-between border-t pt-2">
            <span class="text-slate-700 font-bold">Volumen Real Compensado a 15°C:</span>
            <span class="font-mono font-bold text-amber-700 text-sm">${formatLiters(sample.compensatedVolume15C)}</span>
          </div>
          <div class="flex justify-between text-rose-600">
            <span>Diferencia por Dilatación Térmica:</span>
            <span class="font-mono font-bold">${formatLiters(sample.deltaLiters)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function attachEventListeners() {
  document.getElementById('nav-trucks')?.addEventListener('click', () => {
    state.activeTab = 'trucks';
    renderApp();
  });
  document.getElementById('nav-deliveries')?.addEventListener('click', () => {
    state.activeTab = 'deliveries';
    renderApp();
  });
  document.getElementById('nav-accounts')?.addEventListener('click', () => {
    state.activeTab = 'accounts';
    renderApp();
  });
  document.getElementById('nav-compensator')?.addEventListener('click', () => {
    state.activeTab = 'compensator';
    renderApp();
  });

  document.getElementById('btn-quick-delivery')?.addEventListener('click', () => {
    const truck = state.trucks[0];
    if (!truck) return;

    const delivery = auditorEngine.auditAndDischargeFuel({
      truckId: truck.id,
      compartmentIndex: 1,
      clientName: 'Estancia La Rinconada S.A.',
      clientLocation: 'Ruta Nac 5 Km 240, 9 de Julio',
      expectedSealCode: 'PREC-98104',
      inspectedSealCode: 'PREC-98104',
      isSealIntact: true,
      counterBeforeLiters: 145020.0,
      counterAfterLiters: 147520.0,
      deliveredVolumeLiters: 2500.0,
      fuelTempCelsius: 28.5
    });

    // Debitar de la cuenta corriente en litros
    const debitRes = ledgerService.debitDeliveryLiters({
      clientId: 'CLI-AGRO-01',
      clientName: 'Estancia La Rinconada S.A.',
      fuelTypeCode: 'DIESEL_500',
      liters: 2500.0,
      deliveryId: delivery.id
    });

    state.deliveries.push(delivery);
    state.accounts = [debitRes.account];
    persistState();
    renderApp();
    alert('¡Descarga auditada con éxito! Se verificó el precinto PREC-98104 y se debitaron 2.500 L de la cuenta corriente.');
  });
}

// Inicialización
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    seedDemoData();
    renderApp();
  });
}
