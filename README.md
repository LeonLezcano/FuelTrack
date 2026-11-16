# ⛽ FuelTrack — Distribución Mayorista de Combustibles a Granel, Camiones Cisterna & Compensación 15°C

> **Vertical:** Distribución Mayorista de Combustibles a Granel (Agro, Obras Viales, Minería), Camiones Cisterna & Auditoría de Litros (Res. SE 1102/04)  
> **Arquetipo:** Patrón B — Thermal Volume Compensation ($15^\circ\text{C}$), Seal & Flowmeter Photo Audit & Bulk Liter Commodity Ledger  
> **Versión:** `v1.0.00` &bull; **AiAppFactory Standard**

---

## 🎯 1. Dolor Real de la Industria y Solución Operativa

1. **Mermas Físicas por Dilatación Térmica (Corrección Estándar a $15^\circ\text{C}$):**
   - El combustible varía su densidad volumétrica con el clima ($\alpha \approx 0.00083\text{ / }^\circ\text{C}$ para gasoil). FuelTrack aplica en tiempo real la norma **ASTM Table 54B y Res. SE 1102/04**, recalculando el volumen estándar a $15^\circ\text{C}$ ($V_{15}$) y detectando automáticamente mermas anómalas que superen la tolerancia legal del $0.3\%$.
2. **Robo de Combustible en Ruta ("Ordeñe") y Violación de Precintos:**
   - Auditoría estricta de compartimentos de cisterna independientes con precintos numerados en boca de carga y válvulas de descarga, junto con la foto obligatoria y lectura de cuentavueltas inicial y final del caudalímetro.
3. **Cuenta Corriente Pactada en Litros Físicos de Gasoil:**
   - Protección contra la inflación y devaluación del peso para productores agropecuarios, canteras y constructoras: el cliente adquiere un saldo fijo en litros de Gasoil Grado 2 o Grado 3 y lo consume contra descargas en campo, con desglose impositivo argentino completo (**Neto Gravado + IVA 21% + ICL + IDC**).

---

## 🏗️ 2. Motores Nucleares Integrados

| Motor | Archivo | Responsabilidad |
| :--- | :--- | :--- |
| **#307** | `src/core/thermalFuelCompensatorEngine.js` | Cálculo de volumen corregido a $15^\circ\text{C}$ según coeficiente de dilatación térmica $\alpha$ y auditoría de merma en ruta. |
| **#115/#120** | `src/core/compartmentSealAuditorEngine.js` | Control de camiones cisterna con múltiples compartimentos, validación de precintos y lectura de caudalímetro. |
| **#161/#107** | `src/services/fuelLiterLedgerService.js` | Cuenta corriente en litros físicos por cliente y liquidación impositiva con ICL e IDC fijos por litro. |
| **#159/#245** | `src/utils/cryptoSeal.js` | Sello criptográfico SHA-256 para remitos electrónicos de descarga (ePOD) con código `FT-XXXX`. |

---

## 🧪 3. Arnés de Pruebas Multi-Capa (51 Tests 100% PASS)

```bash
# Ejecución de pruebas
node tests/run_tests.js
```

- **Capa 1 (Unitarias & Fuzzing):** Sanitización XSS, formateo volumétrico en litros y fuzzing caótico con temperaturas extremas (-15°C a 45°C).
- **Capa 2 (Integración & Cisternas):** Auditoría de precintos rotos o discrepantes, descarga conforme y detección de ordeñe en ruta.
- **Capa 3 (Cuenta Corriente en Litros):** Acreditación de pagos anticipados en litros, débitos automáticos por descarga y desglose ICL/IDC.
- **Capa 4 (Seguridad & Reglas):** Verificación de `firestore.rules` y cabeceras CSP cualitativas en `firebase.json`.
- **Capa 5 (E2E):** Flujo completo de carga en refinería a 28°C, entrega en campo con precinto intacto y débito en cuenta corriente agropecuaria.

---

## 🛡️ 4. Auditoría de Seguridad (AppSec Guardian)

```bash
node ../AiAppFactory/tools/security-guardian/index.mjs . --abuse
```

- **Puntaje:** **100/100 Puntos**
- **Vulnerabilidades:** 0 Críticas | 0 Altas | 0 Medias | 0 Bajas
- **Resistencia a Abusos (Capa 7):** Rate limiting activo, protección contra saturación de payloads (Memory Flood) y defensa Strix DAST/SSRF.
