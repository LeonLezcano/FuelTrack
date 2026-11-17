/**
 * FuelTrack - Main Application Logic
 * Consola operativa Offline-First para distribucion de combustibles a granel.
 */

import { ThermalFuelCompensatorEngine, FUEL_TYPES } from './core/thermalFuelCompensatorEngine.js';
import { CompartmentSealAuditorEngine } from './core/compartmentSealAuditorEngine.js';
import { FuelLiterLedgerService } from './services/fuelLiterLedgerService.js';
import { FuelTrackCache } from './services/fuelTrackCache.service.js';
import { sealFuelDeliveryEPOD } from './utils/cryptoSeal.js';
import { formatLiters, formatDateTime } from './utils/formatters.js';
import { Sanitizer } from './utils/sanitizer.js';

const APP_VERSION = 'v1.0.01';
const DEMO_PURGE_KEY = 'fueltrack_demo_purged';
const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB limit (Memory Exhaustion Defense)

const NAV_TAB_BASE =
  'min-h-[48px] px-3.5 py-2 text-xs font-bold rounded-md flex items-center gap-2 transition-colors';
const NAV_TAB_ACTIVE = `${NAV_TAB_BASE} bg-amber-500 text-slate-950`;
const NAV_TAB_INACTIVE = `${NAV_TAB_BASE} bg-slate-800 text-slate-100 hover:bg-slate-700`;

export const state = {
  trucks: [],
  deliveries: [],
  accounts: [],
  activeTab: 'trucks',
  statusMessage: null,
  isDeliveryModalOpen: false,
  isSealingDelivery: false,
  selectedPhotoMeta: null,
  compensator: {
    fuelTypeCode: 'DIESEL_500',
    observedVolumeLiters: 10000,
    observedTempCelsius: 30.0,
    result: null,
    error: null
  },
  ledgerForm: {
    clientName: '',
    fuelTypeCode: 'DIESEL_500',
    liters: 5000,
    pricePerLiterARS: 1200,
    receiptNumber: ''
  }
};

const auditorEngine = new CompartmentSealAuditorEngine();
const ledgerService = new FuelLiterLedgerService();

function isDemoPurged() {
  if (typeof localStorage !== 'undefined') {
    try {
      if (localStorage.getItem(DEMO_PURGE_KEY) === 'true') {
        return true;
      }
    } catch {
      // Ignorar errores de almacenamiento restringido
    }
  }
  return FuelTrackCache.get('demo_purged') === true;
}

function setDemoPurgedFlag(purged) {
  if (typeof localStorage !== 'undefined') {
    try {
      if (purged) {
        localStorage.setItem(DEMO_PURGE_KEY, 'true');
      } else {
        localStorage.removeItem(DEMO_PURGE_KEY);
      }
    } catch {
      // Ignorar errores de almacenamiento restringido
    }
  }
  if (purged) {
    FuelTrackCache.set('demo_purged', true);
  } else {
    FuelTrackCache.remove('demo_purged');
  }
}

function syncEnginesFromState() {
  auditorEngine.trucks = state.trucks.map((t) => ({
    ...t,
    compartments: Array.isArray(t.compartments) ? t.compartments.map((c) => ({ ...c })) : []
  }));
  auditorEngine.deliveries = state.deliveries.map((d) => ({ ...d }));

  ledgerService.accounts = new Map();
  state.accounts.forEach((acc) => {
    if (acc && acc.clientId) {
      ledgerService.accounts.set(acc.clientId, {
        ...acc,
        balancesLiters: { ...(acc.balancesLiters || {}) },
        movements: Array.isArray(acc.movements) ? [...acc.movements] : []
      });
    }
  });
}

function computeCurrentCompensator() {
  try {
    state.compensator.result = ThermalFuelCompensatorEngine.computeVolume15C({
      observedVolumeLiters: state.compensator.observedVolumeLiters,
      observedTempCelsius: state.compensator.observedTempCelsius,
      fuelTypeCode: state.compensator.fuelTypeCode
    });
    state.compensator.error = null;
  } catch (err) {
    state.compensator.result = null;
    state.compensator.error = err?.message || 'Error al calcular la compensación térmica.';
  }
}

export function seedDemoData() {
  computeCurrentCompensator();

  const cachedTrucks = FuelTrackCache.get('trucks');
  const cachedDeliveries = FuelTrackCache.get('deliveries');
  const cachedAccounts = FuelTrackCache.get('accounts');

  if (isDemoPurged()) {
    state.trucks = Array.isArray(cachedTrucks) ? cachedTrucks : [];
    state.deliveries = Array.isArray(cachedDeliveries) ? cachedDeliveries : [];
    state.accounts = Array.isArray(cachedAccounts) ? cachedAccounts : [];
    syncEnginesFromState();
    return;
  }

  if ((cachedTrucks && cachedTrucks.length > 0) || (cachedAccounts && cachedAccounts.length > 0)) {
    state.trucks = cachedTrucks || [];
    state.deliveries = cachedDeliveries || [];
    state.accounts = cachedAccounts || [];
    syncEnginesFromState();
    return;
  }

  auditorEngine.trucks = [];
  auditorEngine.deliveries = [];
  ledgerService.accounts = new Map();

  // Camion cisterna de demo con 3 compartimentos
  const truck1 = auditorEngine.registerTankTruck({
    id: 'TRUCK-01',
    plate: 'AF 342 YP',
    brand: 'Mercedes-Benz Axor 2035 Cisterna',
    driverName: 'Esteban Morales',
    compartments: [
      {
        code: 'COMP-1 (Delantero)',
        capacityLiters: 5000,
        currentFuelCode: 'DIESEL_500',
        currentVolumeLiters: 5000,
        currentSealCode: 'PREC-98104'
      },
      {
        code: 'COMP-2 (Medio)',
        capacityLiters: 4000,
        currentFuelCode: 'EURO_DIESEL',
        currentVolumeLiters: 4000,
        currentSealCode: 'PREC-98105'
      },
      {
        code: 'COMP-3 (Trasero)',
        capacityLiters: 5000,
        currentFuelCode: 'DIESEL_500',
        currentVolumeLiters: 5000,
        currentSealCode: 'PREC-98106'
      }
    ]
  });
  truck1.isDemo = true;

  // Cuenta corriente agropecuaria inicial de demo
  const acc1 = ledgerService.creditLiters({
    clientId: 'CLI-AGRO-01',
    clientName: 'Estancia La Rinconada S.A.',
    fuelTypeCode: 'DIESEL_500',
    liters: 15000,
    pricePerLiterARS: 1180,
    receiptNumber: 'FAC-0004-000129'
  });
  acc1.account.isDemo = true;

  state.trucks = [truck1];
  state.deliveries = [];
  state.accounts = [acc1.account];
  persistState();
}

export function purgeDemoData() {
  setDemoPurgedFlag(true);
  state.trucks = state.trucks.filter((t) => !t.isDemo);
  state.deliveries = state.deliveries.filter((d) => !d.isDemo);
  state.accounts = state.accounts.filter((a) => !a.isDemo);
  syncEnginesFromState();
  persistState();
  state.statusMessage = {
    type: 'info',
    text: 'Registros [DEMO] purgados. No se volverán a sembrar automáticamente.'
  };
  renderApp();
}

export function restoreDemoData() {
  setDemoPurgedFlag(false);
  FuelTrackCache.remove('trucks');
  FuelTrackCache.remove('deliveries');
  FuelTrackCache.remove('accounts');
  seedDemoData();
  state.statusMessage = {
    type: 'info',
    text: 'Datos [DEMO] restaurados para evaluación operativa local.'
  };
  renderApp();
}

export function persistState() {
  FuelTrackCache.set('trucks', state.trucks);
  FuelTrackCache.set('deliveries', state.deliveries);
  FuelTrackCache.set('accounts', state.accounts);
}

function iconSvg(name, className = 'w-4 h-4 shrink-0') {
  const icons = {
    fuel: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    truck: '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2Z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
    ledger: '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/>',
    thermometer: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0Z"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>'
  };
  const body = icons[name] || icons.fuel;
  return `<svg aria-hidden="true" class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function hasDemoRecords() {
  return (
    state.trucks.some((t) => t.isDemo) ||
    state.accounts.some((a) => a.isDemo) ||
    state.deliveries.some((d) => d.isDemo)
  );
}

function renderStatusBanner() {
  if (!state.statusMessage) return '';
  const { type, text } = state.statusMessage;
  const isError = type === 'error';
  const isSuccess = type === 'success';

  const containerClass = isError
    ? 'bg-red-50 border border-red-300 text-red-900'
    : isSuccess
      ? 'bg-green-50 border border-green-300 text-green-900'
      : 'bg-amber-50 border border-amber-300 text-amber-950';

  const role = isError ? 'alert' : 'status';
  const icon = isError ? iconSvg('alert', 'w-5 h-5 shrink-0') : iconSvg('check', 'w-5 h-5 shrink-0');

  return `
    <div id="app-status-banner" role="${role}" aria-live="polite" class="no-print mb-5 rounded-lg p-3.5 flex items-center justify-between gap-3 ${containerClass}">
      <div class="flex items-center gap-2.5 text-sm font-semibold">
        ${icon}
        <span>${Sanitizer.escapeHTML(text)}</span>
      </div>
      <button id="btn-dismiss-status" type="button" aria-label="Cerrar notificación" class="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md hover:bg-black/5">
        ${iconSvg('close', 'w-4 h-4')}
      </button>
    </div>
  `;
}

function renderDemoNoticeBar() {
  if (!hasDemoRecords()) return '';
  return `
    <div class="no-print mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3.5 flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs font-semibold text-amber-950">
        <span class="inline-block px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold mr-1.5">DEMO</span>
        Visualizando flota y cuenta de demostración en almacenamiento local aislado.
      </p>
      <button id="btn-purge-demo" type="button" class="min-h-[44px] px-3.5 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-2">
        ${iconSvg('trash', 'w-4 h-4')}
        <span>Purgar datos demo</span>
      </button>
    </div>
  `;
}

export function renderApp() {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('app');
  if (!root) return;

  const navItems = [
    { id: 'trucks', label: `Cisternas (${state.trucks.length})`, icon: 'truck' },
    { id: 'deliveries', label: `Remitos ePOD (${state.deliveries.length})`, icon: 'receipt' },
    { id: 'accounts', label: `Cta Cte Litros (${state.accounts.length})`, icon: 'ledger' },
    { id: 'compensator', label: 'Calculadora 15°C', icon: 'thermometer' }
  ];

  const html = `
    <header class="no-print bg-slate-900 text-white border-b border-slate-800">
      <div class="max-w-7xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="w-10 h-10 rounded-lg bg-amber-500 text-slate-950 inline-flex items-center justify-center shrink-0">
            ${iconSvg('fuel', 'w-5 h-5')}
          </span>
          <div>
            <h1 class="font-extrabold text-2xl tracking-tight leading-tight text-white">FuelTrack</h1>
            <p class="text-xs text-slate-300">Distribución de Combustibles a Granel y Compensación Térmica 15°C</p>
          </div>
        </div>
        <nav role="tablist" aria-label="Vistas operativas de FuelTrack" class="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          ${navItems
            .map((item) => {
              const isActive = state.activeTab === item.id;
              const btnClass = isActive ? NAV_TAB_ACTIVE : NAV_TAB_INACTIVE;
              const currentAttr = isActive ? ' aria-current="page"' : '';
              return `
                <button
                  id="nav-${item.id}"
                  type="button"
                  role="tab"
                  aria-selected="${isActive ? 'true' : 'false'}"${currentAttr}
                  class="${btnClass}"
                >
                  ${iconSvg(item.icon, 'w-4 h-4')}
                  <span>${Sanitizer.escapeHTML(item.label)}</span>
                </button>
              `;
            })
            .join('')}
        </nav>
      </div>
    </header>

    <main class="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
      ${renderStatusBanner()}
      ${renderDemoNoticeBar()}
      ${renderActiveView()}
    </main>

    <footer class="no-print mt-10 border-t border-slate-300 bg-white py-4 px-4 text-center text-xs text-slate-600">
      FuelTrack &copy; 2026 | AiAppFactory Standard | ${Sanitizer.escapeHTML(APP_VERSION)} | Cálculo referencial según fórmulas Res. SE 1102/04 y ASTM Table 54B (uso operativo local)
    </footer>

    ${renderDeliveryModal()}
  `;

  Sanitizer.safeSetInnerHTML(root, html);
  attachEventListeners();
}

function renderActiveView() {
  if (state.activeTab === 'trucks') return renderTrucksView();
  if (state.activeTab === 'deliveries') return renderDeliveriesView();
  if (state.activeTab === 'accounts') return renderAccountsView();
  if (state.activeTab === 'compensator') return renderCompensatorView();
  return '<p class="text-sm text-slate-700">Vista no encontrada.</p>';
}

function getAvailableCompartments() {
  const options = [];
  state.trucks.forEach((t) => {
    (t.compartments || []).forEach((c) => {
      if (c.currentVolumeLiters > 0) {
        options.push({
          value: `${t.id}:${c.index}`,
          truckId: t.id,
          plate: t.plate,
          compartmentIndex: c.index,
          code: c.code,
          fuelCode: c.currentFuelCode,
          volume: c.currentVolumeLiters,
          sealCode: c.currentSealCode || ''
        });
      }
    });
  });
  return options;
}

function renderTrucksView() {
  const availableCompartments = getAvailableCompartments();
  const canRecordDelivery = availableCompartments.length > 0;

  return `
    <section class="space-y-6" aria-labelledby="heading-trucks">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="heading-trucks" class="text-lg font-bold text-slate-900">Camiones Cisterna y Control de Compartimentos</h2>
          <p class="text-xs text-slate-600">Auditoría de precintos numerados y volumen remanente por tanque.</p>
        </div>
        <button
          id="btn-open-delivery-modal"
          type="button"
          ${canRecordDelivery ? '' : 'disabled'}
          class="min-h-[48px] px-4 py-2.5 rounded-md text-xs font-bold inline-flex items-center gap-2 ${
            canRecordDelivery
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-slate-300 text-slate-600 cursor-not-allowed'
          }"
        >
          ${iconSvg('plus', 'w-4 h-4')}
          <span>Registrar Descarga ePOD</span>
        </button>
      </div>

      ${
        state.trucks.length === 0
          ? `
            <div class="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center space-y-4">
              <p class="text-sm font-semibold text-slate-700">No hay camiones cisterna cargados en la flota local.</p>
              <p class="text-xs text-slate-600">Puede restaurar la unidad de demostración para evaluar la auditoría de precintos y descargas.</p>
              <button id="btn-restore-demo" type="button" class="min-h-[48px] px-4 py-2.5 rounded-md bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-bold inline-flex items-center gap-2">
                ${iconSvg('truck', 'w-4 h-4')}
                <span>Cargar flota de demostración [DEMO]</span>
              </button>
            </div>
          `
          : `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
              ${state.trucks
                .map(
                  (t) => `
                  <article class="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 space-y-4">
                    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                      <div class="flex items-center gap-2">
                        <span class="font-mono tabular-nums text-sm font-extrabold text-slate-900">${Sanitizer.escapeHTML(t.plate)}</span>
                        ${t.isDemo ? '<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-bold">DEMO</span>' : ''}
                      </div>
                      <span class="text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-800 font-mono tabular-nums">${formatLiters(t.totalCapacityLiters)}</span>
                    </div>

                    <div>
                      <h3 class="font-bold text-base text-slate-900">${Sanitizer.escapeHTML(t.brand)}</h3>
                      <p class="text-xs text-slate-600 mt-0.5">Chofer asignado: <strong class="text-slate-800">${Sanitizer.escapeHTML(t.driverName)}</strong></p>
                    </div>

                    <div class="border-t border-slate-200 pt-3 space-y-3">
                      <h4 class="text-sm font-bold text-slate-800">Estado de Compartimentos</h4>
                      <div class="grid grid-cols-1 sm:grid-cols-3 bg-slate-50 rounded-md divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                        ${(t.compartments || [])
                          .map((c) => {
                            const percent = Math.max(
                              0,
                              Math.min(100, Math.round((c.currentVolumeLiters / (c.capacityLiters || 1)) * 100))
                            );
                            return `
                              <div class="p-3 flex flex-col justify-between gap-2">
                                <div class="font-bold text-xs text-slate-700">${Sanitizer.escapeHTML(c.code)}</div>
                                <div class="space-y-1.5">
                                  <div class="flex items-baseline justify-between gap-1">
                                    <span class="text-sm font-extrabold text-slate-900 font-mono tabular-nums">${percent}%</span>
                                    <span class="text-xs font-semibold text-slate-700 font-mono tabular-nums">${formatLiters(c.currentVolumeLiters)}</span>
                                  </div>
                                  <progress class="fuel-progress" value="${percent}" max="100" aria-label="Nivel de ${Sanitizer.escapeHTML(c.code)}: ${percent}%"></progress>
                                </div>
                                <div class="text-xs text-slate-700 font-mono tabular-nums">
                                  Precinto: <strong class="text-slate-800">${c.currentSealCode ? Sanitizer.escapeHTML(c.currentSealCode) : 'Sin precinto'}</strong>
                                </div>
                              </div>
                            `;
                          })
                          .join('')}
                      </div>
                    </div>
                  </article>
                `
                )
                .join('')}
            </div>
          `
      }
    </section>
  `;
}

function renderDeliveriesView() {
  return `
    <section class="space-y-6" aria-labelledby="heading-deliveries">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="heading-deliveries" class="text-lg font-bold text-slate-900">Remitos Electrónicos de Descarga (ePOD)</h2>
          <p class="text-xs text-slate-600">Comprobantes con lectura de caudalímetro, verificación de precintos, temperatura y firma SHA-256.</p>
        </div>
        ${
          state.deliveries.length > 0
            ? `
              <button id="btn-print-epod" type="button" class="no-print min-h-[48px] px-4 py-2.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-2">
                ${iconSvg('print', 'w-4 h-4')}
                <span>Imprimir Remitos</span>
              </button>
            `
            : ''
        }
      </div>

      ${
        state.deliveries.length === 0
          ? `
            <div class="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center space-y-3">
              <p class="text-sm font-semibold text-slate-700">No hay descargas registradas en esta jornada.</p>
              <p class="text-xs text-slate-600">Registre una descarga desde la pestaña Cisternas para emitir su remito ePOD firmado.</p>
            </div>
          `
          : `
            <div class="space-y-4">
              ${state.deliveries
                .map((d) => {
                  const statusBadge = d.isApproved
                    ? '<span class="px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs font-bold">Entrega Conforme</span>'
                    : '<span class="px-2 py-0.5 rounded bg-red-50 text-red-700 text-xs font-bold">Bloqueado por Anomalía</span>';

                  const sealBadge = d.isSealIntact
                    ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 font-bold">Intacto</span>'
                    : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold">Violado</span>';

                  return `
                    <article class="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 space-y-3">
                      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                        <div class="space-y-0.5">
                          <h3 class="font-bold text-base text-slate-900">${Sanitizer.escapeHTML(d.id)} | ${Sanitizer.escapeHTML(d.clientName)}</h3>
                          <p class="text-xs text-slate-600">${Sanitizer.escapeHTML(formatDateTime(d.dischargedAt))}${d.clientLocation ? ` | ${Sanitizer.escapeHTML(d.clientLocation)}` : ''}</p>
                        </div>
                        <div class="flex items-center gap-2">
                          ${statusBadge}
                          <span class="font-mono tabular-nums font-extrabold text-sm text-amber-700">${formatLiters(d.deliveredVolumeLiters)}</span>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-700">
                        <div>Camión: <strong class="text-slate-900 font-mono">${Sanitizer.escapeHTML(d.truckPlate)}</strong></div>
                        <div>Chofer: <strong class="text-slate-900">${Sanitizer.escapeHTML(d.driverName)}</strong></div>
                        <div>Contador Inicial: <strong class="text-slate-900 font-mono tabular-nums">${Sanitizer.escapeHTML(String(d.counterBeforeLiters))} L</strong></div>
                        <div>Contador Final: <strong class="text-slate-900 font-mono tabular-nums">${Sanitizer.escapeHTML(String(d.counterAfterLiters))} L</strong></div>
                      </div>

                      <div class="border-t border-slate-200 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
                        <div class="flex flex-wrap items-center gap-2">
                          <span>Precinto Verificado: <strong class="font-mono text-slate-900">${Sanitizer.escapeHTML(d.inspectedSealCode || 'N/A')}</strong></span>
                          ${sealBadge}
                        </div>
                        <div class="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                          <span>Temp: <strong class="text-slate-900">${Sanitizer.escapeHTML(String(d.fuelTempCelsius))} °C</strong></span>
                          ${
                            d.verificationCode
                              ? `<span>Sello ePOD: <strong class="text-slate-900">${Sanitizer.escapeHTML(d.verificationCode)}</strong></span>`
                              : ''
                          }
                        </div>
                      </div>

                      ${
                        d.flowmeterPhotoName
                          ? `<p class="text-xs text-slate-600">Evidencia fotográfica adjunta: <strong class="text-slate-800">${Sanitizer.escapeHTML(d.flowmeterPhotoName)}</strong></p>`
                          : ''
                      }

                      ${
                        Array.isArray(d.errors) && d.errors.length > 0
                          ? `
                            <div class="bg-red-50 rounded-md p-3 text-xs text-red-700 space-y-1">
                              ${d.errors.map((err) => `<p class="font-semibold">${Sanitizer.escapeHTML(err)}</p>`).join('')}
                            </div>
                          `
                          : ''
                      }
                    </article>
                  `;
                })
                .join('')}
            </div>
          `
      }
    </section>
  `;
}

function renderAccountsView() {
  return `
    <section class="space-y-6" aria-labelledby="heading-accounts">
      <div>
        <h2 id="heading-accounts" class="text-lg font-bold text-slate-900">Cuentas Corrientes en Litros de Combustible</h2>
        <p class="text-xs text-slate-600">Saldos físicos acreditados por pago anticipado vs entregas descontadas en campo.</p>
      </div>

      ${
        state.accounts.length === 0
          ? `
            <div class="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center space-y-4">
              <p class="text-sm font-semibold text-slate-700">No hay cuentas corrientes activas en el libro de litros.</p>
              <p class="text-xs text-slate-600">Acredite un saldo en litros debajo o restaure los datos de demostración.</p>
              <button id="btn-restore-demo" type="button" class="min-h-[48px] px-4 py-2.5 rounded-md bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-bold inline-flex items-center gap-2">
                <span>Restaurar datos [DEMO]</span>
              </button>
            </div>
          `
          : `
            <div class="space-y-4">
              ${state.accounts
                .map(
                  (a) => `
                  <article class="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 space-y-4">
                    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                      <div class="flex items-center gap-2">
                        <h3 class="font-bold text-base text-slate-900">${Sanitizer.escapeHTML(a.clientName)}</h3>
                        ${a.isDemo ? '<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-bold">DEMO</span>' : ''}
                      </div>
                      <span class="text-xs font-mono font-bold text-slate-600">${Sanitizer.escapeHTML(a.clientId)}</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 bg-slate-50 rounded-md divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                      <div class="p-3.5 text-center space-y-1">
                        <p class="text-xs font-bold text-slate-700">Gasoil Grado 2</p>
                        <p class="text-lg font-black text-amber-700 font-mono tabular-nums">${formatLiters(a.balancesLiters?.DIESEL_500 || 0)}</p>
                      </div>
                      <div class="p-3.5 text-center space-y-1">
                        <p class="text-xs font-bold text-slate-700">Gasoil Euro Grado 3</p>
                        <p class="text-lg font-black text-slate-900 font-mono tabular-nums">${formatLiters(a.balancesLiters?.EURO_DIESEL || 0)}</p>
                      </div>
                      <div class="p-3.5 text-center space-y-1">
                        <p class="text-xs font-bold text-slate-700">Nafta Súper</p>
                        <p class="text-lg font-black text-slate-900 font-mono tabular-nums">${formatLiters(a.balancesLiters?.NAFTA_SUPER || 0)}</p>
                      </div>
                    </div>
                  </article>
                `
                )
                .join('')}
            </div>
          `
      }

      <form id="ledger-credit-form" class="no-print bg-white border border-slate-300 rounded-lg p-4 sm:p-5 space-y-4">
        <div class="border-b border-slate-200 pb-3">
          <h3 class="text-base font-bold text-slate-900">Acreditar Pago Anticipado en Litros</h3>
          <p class="text-xs text-slate-600">Registra litros comprados por un cliente para consumo contra remito en campo.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label for="ledger-client-name" class="block text-xs font-bold text-slate-700 mb-1.5">Razón Social del Cliente</label>
            <input id="ledger-client-name" type="text" required placeholder="Ej. Agropecuaria Sur S.A." value="${Sanitizer.escapeHTML(state.ledgerForm.clientName)}" class="w-full min-h-[48px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md" />
          </div>
          <div>
            <label for="ledger-fuel-type" class="block text-xs font-bold text-slate-700 mb-1.5">Combustible</label>
            <select id="ledger-fuel-type" class="w-full min-h-[48px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md">
              <option value="DIESEL_500"${state.ledgerForm.fuelTypeCode === 'DIESEL_500' ? ' selected' : ''}>Gasoil Grado 2</option>
              <option value="EURO_DIESEL"${state.ledgerForm.fuelTypeCode === 'EURO_DIESEL' ? ' selected' : ''}>Gasoil Euro Grado 3</option>
              <option value="NAFTA_SUPER"${state.ledgerForm.fuelTypeCode === 'NAFTA_SUPER' ? ' selected' : ''}>Nafta Súper</option>
            </select>
          </div>
          <div>
            <label for="ledger-liters" class="block text-xs font-bold text-slate-700 mb-1.5">Litros a Acreditar</label>
            <input id="ledger-liters" type="number" min="1" step="100" required value="${Sanitizer.escapeHTML(String(state.ledgerForm.liters))}" class="w-full min-h-[48px] px-3 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-md" />
          </div>
          <div>
            <label for="ledger-receipt" class="block text-xs font-bold text-slate-700 mb-1.5">Nro. Comprobante</label>
            <input id="ledger-receipt" type="text" placeholder="FAC-0001-000240" value="${Sanitizer.escapeHTML(state.ledgerForm.receiptNumber)}" class="w-full min-h-[48px] px-3 py-2 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-md" />
          </div>
        </div>
        <div class="flex justify-end">
          <button type="submit" class="min-h-[48px] px-5 py-2.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-2">
            ${iconSvg('plus', 'w-4 h-4')}
            <span>Acreditar Litros en Cuenta</span>
          </button>
        </div>
      </form>
    </section>
  `;
}

function renderCompensatorView() {
  const { fuelTypeCode, observedVolumeLiters, observedTempCelsius, result, error } = state.compensator;
  const deltaClass = result && result.deltaLiters < 0 ? 'text-red-700' : 'text-green-700';

  return `
    <section class="space-y-6 max-w-2xl mx-auto" aria-labelledby="heading-compensator">
      <div>
        <h2 id="heading-compensator" class="text-lg font-bold text-slate-900">Calculadora de Corrección Térmica a 15°C</h2>
        <p class="text-xs text-slate-600">Fórmulas ASTM Table 54B y Res. SE 1102/04: Factor VCF y variación térmica volumétrica.</p>
      </div>

      <div class="bg-white border border-slate-300 rounded-lg p-5 space-y-5">
        <form id="compensator-form" class="space-y-4">
          <div>
            <label for="comp-fuel-type" class="block text-xs font-bold text-slate-700 mb-1.5">Tipo de Combustible (coeficiente alfa)</label>
            <select id="comp-fuel-type" class="w-full min-h-[48px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md">
              ${Object.values(FUEL_TYPES)
                .map(
                  (f) => `<option value="${Sanitizer.escapeHTML(f.code)}"${f.code === fuelTypeCode ? ' selected' : ''}>${Sanitizer.escapeHTML(f.name)} (alfa ${f.alpha})</option>`
                )
                .join('')}
            </select>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="comp-volume" class="block text-xs font-bold text-slate-700 mb-1.5">Volumen Observado (Litros)</label>
              <input id="comp-volume" type="number" min="0" step="10" required value="${Sanitizer.escapeHTML(String(observedVolumeLiters))}" class="w-full min-h-[48px] px-3 py-2 text-sm font-mono tabular-nums font-bold text-slate-900 bg-white border border-slate-300 rounded-md" />
            </div>
            <div>
              <label for="comp-temp" class="block text-xs font-bold text-slate-700 mb-1.5">Temperatura Observada (°C)</label>
              <input id="comp-temp" type="number" min="-30" max="60" step="0.1" required value="${Sanitizer.escapeHTML(String(observedTempCelsius))}" class="w-full min-h-[48px] px-3 py-2 text-sm font-mono tabular-nums font-bold text-slate-900 bg-white border border-slate-300 rounded-md" />
            </div>
          </div>

          <button id="btn-calc-15c" type="submit" class="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold">
            Calcular Volumen a 15°C
          </button>
        </form>

        ${
          error
            ? `<div role="alert" class="bg-red-50 rounded-md p-3.5 text-xs font-semibold text-red-700">${Sanitizer.escapeHTML(error)}</div>`
            : ''
        }

        ${
          result
            ? `
              <dl class="border-t border-slate-200 pt-4 bg-slate-50 rounded-md p-4 text-xs space-y-3">
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-slate-700 font-semibold">Factor de Corrección Volumétrica (VCF)</dt>
                  <dd class="font-mono tabular-nums font-bold text-slate-900">${Sanitizer.escapeHTML(String(result.vcf))}</dd>
                </div>
                <div class="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                  <dt class="text-slate-800 font-bold">Volumen Real Compensado a 15°C</dt>
                  <dd class="font-mono tabular-nums font-extrabold text-amber-700 text-sm">${formatLiters(result.compensatedVolume15C)}</dd>
                </div>
                <div class="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                  <dt class="text-slate-700 font-semibold">Diferencia por Dilatación Térmica</dt>
                  <dd class="font-mono tabular-nums font-bold ${deltaClass}">${formatLiters(result.deltaLiters)}</dd>
                </div>
              </dl>
            `
            : ''
        }
      </div>
    </section>
  `;
}

function renderDeliveryModal() {
  if (!state.isDeliveryModalOpen) return '';
  const compartments = getAvailableCompartments();
  const firstComp = compartments[0] || {};
  const defaultClient = state.accounts[0]?.clientName || '';

  return `
    <div id="delivery-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-modal-title" class="no-print fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4 overflow-y-auto">
      <div class="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-5 space-y-4 my-auto">
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 id="delivery-modal-title" class="text-base font-bold text-slate-900">Registrar Descarga Auditada (ePOD)</h3>
          <button id="btn-close-delivery-modal" type="button" aria-label="Cerrar formulario de descarga" class="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-100">
            ${iconSvg('close', 'w-5 h-5')}
          </button>
        </div>

        <form id="delivery-form" class="space-y-4">
          <div>
            <label for="delivery-compartment" class="block text-xs font-bold text-slate-700 mb-1.5">Cisterna y Compartimento</label>
            <select id="delivery-compartment" required class="w-full min-h-[48px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md">
              ${compartments
                .map(
                  (c) => `<option value="${Sanitizer.escapeHTML(c.value)}">${Sanitizer.escapeHTML(c.plate)} | ${Sanitizer.escapeHTML(c.code)} (${formatLiters(c.volume)})</option>`
                )
                .join('')}
            </select>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="delivery-client" class="block text-xs font-bold text-slate-700 mb-1.5">Cliente Destinatario</label>
              <input id="delivery-client" type="text" required value="${Sanitizer.escapeHTML(defaultClient)}" placeholder="Nombre o razón social" class="w-full min-h-[48px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md" />
            </div>
            <div>
              <label for="delivery-location" class="block text-xs font-bold text-slate-700 mb-1.5">Ubicación / Establecimiento</label>
              <input id="delivery-location" type="text" placeholder="Ruta / Km / Localidad" class="w-full min-h-[48px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label for="delivery-seal-expected" class="block text-xs font-bold text-slate-700 mb-1.5">Precinto Remito</label>
              <input id="delivery-seal-expected" type="text" readonly value="${Sanitizer.escapeHTML(firstComp.sealCode || '')}" class="w-full min-h-[48px] px-3 py-2 text-sm font-mono text-slate-700 bg-slate-100 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label for="delivery-seal-inspected" class="block text-xs font-bold text-slate-700 mb-1.5">Precinto Inspeccionado</label>
              <input id="delivery-seal-inspected" type="text" required value="${Sanitizer.escapeHTML(firstComp.sealCode || '')}" class="w-full min-h-[48px] px-3 py-2 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-md" />
            </div>
            <div>
              <label for="delivery-seal-intact" class="block text-xs font-bold text-slate-700 mb-1.5">Estado del Precinto</label>
              <select id="delivery-seal-intact" class="w-full min-h-[48px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md">
                <option value="true" selected>Intacto</option>
                <option value="false">Roto / Violado</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="delivery-counter-before" class="block text-xs font-bold text-slate-700 mb-1.5">Caudalímetro Inicial (L)</label>
              <input id="delivery-counter-before" type="number" step="0.1" min="0" required value="145020" class="w-full min-h-[48px] px-3 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-md" />
            </div>
            <div>
              <label for="delivery-counter-after" class="block text-xs font-bold text-slate-700 mb-1.5">Caudalímetro Final (L)</label>
              <input id="delivery-counter-after" type="number" step="0.1" min="0" required value="147520" class="w-full min-h-[48px] px-3 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-md" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="delivery-volume" class="block text-xs font-bold text-slate-700 mb-1.5">Volumen Descargado (L)</label>
              <input id="delivery-volume" type="number" step="1" min="1" required value="2500" class="w-full min-h-[48px] px-3 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-md" />
            </div>
            <div>
              <label for="delivery-temp" class="block text-xs font-bold text-slate-700 mb-1.5">Temperatura Combustible (°C)</label>
              <input id="delivery-temp" type="number" step="0.1" min="-30" max="60" required value="28.5" class="w-full min-h-[48px] px-3 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-md" />
            </div>
          </div>

          <div>
            <label for="delivery-photo" class="block text-xs font-bold text-slate-700 mb-1.5">Foto del Caudalímetro / Precinto (opcional, máx. 2 MB)</label>
            <input id="delivery-photo" type="file" accept="image/*" class="w-full min-h-[44px] px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-300 rounded-md" />
          </div>

          <div class="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button id="btn-cancel-delivery-modal" type="button" class="min-h-[48px] px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 text-xs font-bold">
              Cancelar
            </button>
            <button
              id="btn-submit-delivery"
              type="submit"
              ${state.isSealingDelivery ? 'disabled' : ''}
              class="min-h-[48px] px-5 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold"
            >
              ${state.isSealingDelivery ? 'Sellando ePOD SHA-256...' : 'Auditar y Emitir ePOD'}
            </button>
          </div>
        </form>
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

  document.getElementById('btn-dismiss-status')?.addEventListener('click', () => {
    state.statusMessage = null;
    renderApp();
  });

  document.getElementById('btn-purge-demo')?.addEventListener('click', () => {
    purgeDemoData();
  });

  document.getElementById('btn-restore-demo')?.addEventListener('click', () => {
    restoreDemoData();
  });

  document.getElementById('btn-print-epod')?.addEventListener('click', () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  });

  document.getElementById('btn-open-delivery-modal')?.addEventListener('click', () => {
    state.selectedPhotoMeta = null;
    state.isDeliveryModalOpen = true;
    renderApp();
    document.getElementById('delivery-client')?.focus();
  });

  const closeModal = () => {
    if (!state.isDeliveryModalOpen) return;
    state.isDeliveryModalOpen = false;
    state.isSealingDelivery = false;
    renderApp();
    document.getElementById('btn-open-delivery-modal')?.focus();
  };

  document.getElementById('btn-close-delivery-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-delivery-modal')?.addEventListener('click', closeModal);
  document.getElementById('delivery-modal')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'delivery-modal') {
      closeModal();
    }
  });

  document.getElementById('delivery-compartment')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const match = getAvailableCompartments().find((c) => c.value === val);
    const expectedInput = document.getElementById('delivery-seal-expected');
    const inspectedInput = document.getElementById('delivery-seal-inspected');
    if (match && expectedInput) {
      expectedInput.value = match.sealCode || '';
      if (inspectedInput) inspectedInput.value = match.sealCode || '';
    }
  });

  document.getElementById('delivery-photo')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      state.selectedPhotoMeta = null;
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      state.statusMessage = {
        type: 'error',
        text: `La imagen "${file.name}" supera el límite de 2 MB para almacenamiento offline.`
      };
      e.target.value = '';
      state.selectedPhotoMeta = null;
      renderApp();
      return;
    }
    state.selectedPhotoMeta = { name: file.name, sizeBytes: file.size };
  });

  document.getElementById('delivery-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const compValue = document.getElementById('delivery-compartment')?.value || '';
      const [truckId, compIdxRaw] = compValue.split(':');
      const compartmentIndex = Number(compIdxRaw);
      const clientName = document.getElementById('delivery-client')?.value?.trim() || '';
      const clientLocation = document.getElementById('delivery-location')?.value?.trim() || '';
      const expectedSealCode = document.getElementById('delivery-seal-expected')?.value?.trim() || null;
      const inspectedSealCode = document.getElementById('delivery-seal-inspected')?.value?.trim() || null;
      const isSealIntact = document.getElementById('delivery-seal-intact')?.value === 'true';
      const counterBeforeLiters = Number(document.getElementById('delivery-counter-before')?.value);
      const counterAfterLiters = Number(document.getElementById('delivery-counter-after')?.value);
      const deliveredVolumeLiters = Number(document.getElementById('delivery-volume')?.value);
      const fuelTempCelsius = Number(document.getElementById('delivery-temp')?.value);

      if (!truckId || !compartmentIndex || !clientName) {
        throw new Error('Complete el compartimento y el cliente destinatario.');
      }

      state.isSealingDelivery = true;
      renderApp();

      syncEnginesFromState();
      const rawDelivery = auditorEngine.auditAndDischargeFuel({
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
        fuelTempCelsius,
        flowmeterPhotoUrl: state.selectedPhotoMeta ? `local-file://${state.selectedPhotoMeta.name}` : ''
      });

      const sealedDelivery = await sealFuelDeliveryEPOD({
        ...rawDelivery,
        flowmeterPhotoName: state.selectedPhotoMeta ? state.selectedPhotoMeta.name : null
      });

      if (sealedDelivery.isApproved) {
        const matchedAccount = state.accounts.find(
          (a) => a.clientName.toLowerCase() === clientName.toLowerCase()
        );
        if (matchedAccount) {
          ledgerService.debitDeliveryLiters({
            clientId: matchedAccount.clientId,
            clientName: matchedAccount.clientName,
            fuelTypeCode: sealedDelivery.fuelTypeCode,
            liters: deliveredVolumeLiters,
            deliveryId: sealedDelivery.id
          });
          state.accounts = Array.from(ledgerService.accounts.values());
        }
      }

      state.trucks = auditorEngine.trucks;
      state.deliveries.push(sealedDelivery);
      state.isDeliveryModalOpen = false;
      state.isSealingDelivery = false;
      state.selectedPhotoMeta = null;
      persistState();

      state.statusMessage = sealedDelivery.isApproved
        ? {
            type: 'success',
            text: `Descarga auditada con éxito. ePOD ${sealedDelivery.verificationCode} emitido (${formatLiters(deliveredVolumeLiters)}).`
          }
        : {
            type: 'error',
            text: `Descarga bloqueada por anomalía (${sealedDelivery.errors[0] || 'revisar precinto/caudalímetro'}).`
          };
      renderApp();
    } catch (err) {
      state.isSealingDelivery = false;
      state.statusMessage = {
        type: 'error',
        text: err?.message || 'No se pudo procesar la auditoría de descarga.'
      };
      renderApp();
    }
  });

  document.getElementById('ledger-credit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const clientName = document.getElementById('ledger-client-name')?.value?.trim() || '';
      const fuelTypeCode = document.getElementById('ledger-fuel-type')?.value || 'DIESEL_500';
      const liters = Number(document.getElementById('ledger-liters')?.value);
      const receiptNumber = document.getElementById('ledger-receipt')?.value?.trim() || 'REC-LOCAL';

      if (!clientName || !Number.isFinite(liters) || liters <= 0) {
        throw new Error('Ingrese una razón social válida y una cantidad positiva de litros.');
      }

      syncEnginesFromState();
      const existing = state.accounts.find(
        (a) => a.clientName.toLowerCase() === clientName.toLowerCase()
      );
      const clientId = existing
        ? existing.clientId
        : `CLI-${Date.now().toString(36).toUpperCase()}`;

      ledgerService.creditLiters({
        clientId,
        clientName,
        fuelTypeCode,
        liters,
        pricePerLiterARS: 1200,
        receiptNumber
      });

      state.accounts = Array.from(ledgerService.accounts.values());
      state.ledgerForm = { clientName: '', fuelTypeCode, liters: 5000, pricePerLiterARS: 1200, receiptNumber: '' };
      persistState();
      state.statusMessage = {
        type: 'success',
        text: `Se acreditaron ${formatLiters(liters)} en la cuenta de ${clientName}.`
      };
      renderApp();
    } catch (err) {
      state.statusMessage = {
        type: 'error',
        text: err?.message || 'Error al acreditar litros en cuenta corriente.'
      };
      renderApp();
    }
  });

  document.getElementById('compensator-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fuelTypeCode = document.getElementById('comp-fuel-type')?.value || 'DIESEL_500';
    const observedVolumeLiters = Number(document.getElementById('comp-volume')?.value);
    const observedTempCelsius = Number(document.getElementById('comp-temp')?.value);

    state.compensator.fuelTypeCode = fuelTypeCode;
    state.compensator.observedVolumeLiters = observedVolumeLiters;
    state.compensator.observedTempCelsius = observedTempCelsius;

    if (!Number.isFinite(observedVolumeLiters) || observedVolumeLiters < 0) {
      state.compensator.result = null;
      state.compensator.error = 'El volumen observado debe ser un número mayor o igual a 0.';
      renderApp();
      return;
    }

    computeCurrentCompensator();
    renderApp();
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.isDeliveryModalOpen) {
      state.isDeliveryModalOpen = false;
      state.isSealingDelivery = false;
      renderApp();
      document.getElementById('btn-open-delivery-modal')?.focus();
    }
  });
}

// Inicialización
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    seedDemoData();
    renderApp();
  });
}
