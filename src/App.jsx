import { useState, useCallback } from 'react'
import './App.css'

// ─── Constants from the Mekanism wiki ───────────────────────────────────────
const MIN_INJECTION = 2
const MAX_INJECTION = 98      // internal mixing cap
const MAX_DT_DIRECT = 1000    // direct D-T Fuel injection cap (mB/t)

// Air-cooled: injection_rate × 200,000 FE/t
// Derived: rate=2 → 400k FE/t ; rate=98 → 19.6M FE/t
const AIR_COOLED_COEFF = 200_000

// Water-cooled (high-efficiency Industrial Turbine):
//   reactor direct : rate × 50,000 FE/t
//   turbine        : rate × 427,500 FE/t
//   total          : rate × 477,500 FE/t
// Derived: rate=4 → 1.91M total ; rate=98 → 46.8M total
const WATER_REACTOR_COEFF = 50_000
const WATER_TURBINE_COEFF = 427_500

// Direct D-T Fuel injection: 400,000 FE per mB/t of D-T Fuel
const DT_DIRECT_ENERGY_PER_MB = 400_000

const TICKS_PER_SECOND = 20
const TICKS_PER_MINUTE = 1_200
const TICKS_PER_HOUR = 72_000

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatFE(fe) {
  if (fe >= 1e9) return `${(fe / 1e9).toLocaleString('en', { maximumFractionDigits: 2 })} GFE`
  if (fe >= 1e6) return `${(fe / 1e6).toLocaleString('en', { maximumFractionDigits: 2 })} MFE`
  if (fe >= 1e3) return `${(fe / 1e3).toLocaleString('en', { maximumFractionDigits: 1 })} kFE`
  return `${fe.toLocaleString('en')} FE`
}

function formatMB(mb) {
  if (mb >= 1_000_000) return `${(mb / 1_000_000).toLocaleString('en', { maximumFractionDigits: 2 })} kB`
  return `${mb.toLocaleString('en', { maximumFractionDigits: 1 })} mB`
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function Stat({ label, value, cls = '' }) {
  return (
    <div className="stat-row">
      <span className="stat-row-label">{label}</span>
      <span className={`stat-row-value ${cls}`}>{value}</span>
    </div>
  )
}

function FormulaBlock({ children }) {
  return <code className="formula-block">{children}</code>
}

function Inline({ children }) {
  return <code className="formula-inline">{children}</code>
}

const LINKS = [
  {
    label: 'FTB Wiki',
    href: 'https://ftb.fandom.com/wiki/Fusion_Reactor_(Mekanism)',
    icon: '📖',
  },
  {
    label: 'Mekanism',
    href: 'https://www.curseforge.com/minecraft/mc-mods/mekanism',
    icon: '⚙',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/Lauwed/mekanism-fission-reactor-calculator',
    icon: (
      <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
      </svg>
    ),
  },
]

function NavLinks({ className }) {
  return (
    <nav className={className}>
      {LINKS.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="nav-link">
          <span className="nav-link-icon">{l.icon}</span>
          {l.label}
        </a>
      ))}
    </nav>
  )
}

const REPORT_URL =
  'https://github.com/Lauwed/mekanism-fission-reactor-calculator/issues/new' +
  '?title=Incorrect+calculation+report' +
  '&labels=bug' +
  '&body=' +
  encodeURIComponent(
    '**What is wrong:**\n\n\n**Expected result:**\n\n\n**Settings used (injection mode, rate, cooling):**\n\n'
  )

function ReportButton() {
  return (
    <a
      href={REPORT_URL}
      target="_blank"
      rel="noreferrer"
      className="report-btn"
      data-tooltip="Report a bug or a calculation error"
    >
      <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm9-1v4a1 1 0 1 1-2 0V7a1 1 0 0 1 2 0zM8 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
      </svg>
      Report an error
    </a>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState('internal')  // 'internal' | 'direct'
  const [cooling, setCooling] = useState('air') // 'air' | 'water'
  const [injectionRate, setInjectionRate] = useState(2)
  const [dtDirect, setDtDirect] = useState(2)

  // ── Derived values — internal mixing ─────────────────────────────────────
  const dPerTick = injectionRate / 2
  const tPerTick = injectionRate / 2
  const dtPerTick = injectionRate / 2

  const airFE = injectionRate * AIR_COOLED_COEFF
  const waterReactorFE = injectionRate * WATER_REACTOR_COEFF
  const waterTurbineFE = injectionRate * WATER_TURBINE_COEFF
  const waterTotalFE = waterReactorFE + waterTurbineFE

  const internalFE = cooling === 'air' ? airFE : waterTotalFE

  // ── Derived values — direct injection ────────────────────────────────────
  const directDT = Math.min(Math.max(1, dtDirect), MAX_DT_DIRECT)
  const directFE = directDT * DT_DIRECT_ENERGY_PER_MB

  const isInternal = mode === 'internal'

  const handleSlider = useCallback((e) => {
    let v = parseInt(e.target.value, 10)
    if (v % 2 !== 0) v = v - 1
    setInjectionRate(Math.max(MIN_INJECTION, Math.min(MAX_INJECTION, v)))
  }, [])

  const handleDtInput = useCallback((e) => {
    const v = parseInt(e.target.value, 10)
    if (!isNaN(v) && v > 0) setDtDirect(Math.min(v, MAX_DT_DIRECT))
  }, [])

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-nav">
          <NavLinks className="nav-links" />
          <ReportButton />
        </div>
        <h1><span className="icon">⚛</span> Mekanism Fusion Reactor — Fuel Calculator</h1>
        <p>
          Calculate D-T Fuel consumption and energy output based on the injection rate.
          Data sourced from the FTB Wiki — Mekanism v9 / v10.
        </p>
      </header>

      {/* ── Mode selector ── */}
      <div className="mode-selector">
        <div className="mode-label">Injection mode</div>
        <div className="mode-tabs">
          <button
            className={`mode-tab ${mode === 'internal' ? 'active' : ''}`}
            onClick={() => setMode('internal')}
          >
            Internal mixing (D + T)
          </button>
          <button
            className={`mode-tab ${mode === 'direct' ? 'active' : ''}`}
            onClick={() => setMode('direct')}
          >
            Pre-mixed D-T Fuel (direct injection)
          </button>
        </div>
      </div>

      {/* ── Parameters ── */}
      <div className="card">
        <div className="card-title">Parameters</div>

        {isInternal ? (
          <>
            {/* Cooling selector */}
            <div style={{ marginBottom: 20 }}>
              <div className="mode-label" style={{ marginBottom: 8 }}>Cooling method</div>
              <div className="mode-tabs">
                <button
                  className={`mode-tab ${cooling === 'air' ? 'active' : ''}`}
                  onClick={() => setCooling('air')}
                >
                  Air-cooled
                </button>
                <button
                  className={`mode-tab ${cooling === 'water' ? 'active' : ''}`}
                  onClick={() => setCooling('water')}
                >
                  Water-cooled (+ Industrial Turbine)
                </button>
              </div>
            </div>

            {/* Injection rate slider */}
            <div className="injection-control">
              <div className="injection-header">
                <span className="injection-label">Injection Rate</span>
                <span className="injection-value">
                  {injectionRate}
                  <span className="injection-unit">({dPerTick} mB/t × 2 components)</span>
                </span>
              </div>
              <div className="slider-wrap">
                <input
                  type="range"
                  className="slider"
                  min={MIN_INJECTION}
                  max={MAX_INJECTION}
                  step={2}
                  value={injectionRate}
                  onChange={handleSlider}
                />
                <div className="slider-bounds">
                  <span className="slider-bound">Min: 2</span>
                  <span className="slider-bound">Max: 98</span>
                </div>
              </div>

              <div className="explanation">
                <strong>How does the injection rate work?</strong><br />
                The value set in the <em>Fuel</em> tab of the Reactor Controller determines
                how fast D-T Fuel is mixed and injected into the plasma chamber.
                It must be an <strong>even integer</strong> (2, 4, 6… up to 98).<br /><br />
                Every game tick (1/20th of a second), the reactor consumes:
                <ul>
                  <li><span className="formula">injection_rate ÷ 2</span> mB of Deuterium</li>
                  <li><span className="formula">injection_rate ÷ 2</span> mB of Tritium</li>
                </ul>
                The 1:1 mix yields as many mB of D-T Fuel as there are mB of each component.
              </div>
            </div>
          </>
        ) : (
          <div className="injection-control">
            <div className="injection-header">
              <span className="injection-label">Direct D-T Fuel flow rate</span>
              <span className="injection-value">
                {directDT}
                <span className="injection-unit">mB/t</span>
              </span>
            </div>
            <div className="slider-wrap">
              <input
                type="range"
                className="slider"
                min={1}
                max={MAX_DT_DIRECT}
                step={1}
                value={dtDirect}
                onChange={handleDtInput}
              />
              <div className="slider-bounds">
                <span className="slider-bound">Min: 1</span>
                <span className="slider-bound">Max: {MAX_DT_DIRECT}</span>
              </div>
            </div>

            <div className="explanation">
              <strong>Direct injection of pre-mixed D-T Fuel</strong><br />
              D-T Fuel can be produced outside the reactor in a <em>Chemical Infuser</em>
              (ratio 1 mB D + 1 mB T → 1 mB D-T Fuel) and piped directly into the reactor
              via a Reactor Port. This fuel is burned immediately,{' '}
              <strong>bypassing the configured injection rate</strong>.<br /><br />
              This method allows far exceeding the internal cap of 49 mB/t,
              up to a maximum of <strong>{MAX_DT_DIRECT} mB/t</strong>.
              <ul>
                <li>Current rate: <span className="formula">{directDT} mB/t</span></li>
                <li>
                  Energy: <span className="formula">{directDT} × 400,000 = {(directFE / 1e6).toFixed(0)} MFE/t</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {isInternal ? (
        <>
          <div className="results-grid">

            {/* Deuterium */}
            <div className="result-card">
              <div className="result-card-header">
                <div className="result-dot blue" />
                <span className="result-title">Deuterium (D)</span>
              </div>
              <div className="stat-rows">
                <Stat label="Per tick" value={`${dPerTick} mB/t`} cls="highlight" />
                <div className="divider" />
                <Stat label="Per second (×20)" value={formatMB(dPerTick * TICKS_PER_SECOND) + '/s'} />
                <Stat label="Per minute (×1,200)" value={formatMB(dPerTick * TICKS_PER_MINUTE) + '/min'} />
                <Stat label="Per hour (×72,000)" value={formatMB(dPerTick * TICKS_PER_HOUR) + '/h'} />
              </div>
            </div>

            {/* Tritium */}
            <div className="result-card">
              <div className="result-card-header">
                <div className="result-dot green" />
                <span className="result-title">Tritium (T)</span>
              </div>
              <div className="stat-rows">
                <Stat label="Per tick" value={`${tPerTick} mB/t`} cls="highlight green" />
                <div className="divider" />
                <Stat label="Per second (×20)" value={formatMB(tPerTick * TICKS_PER_SECOND) + '/s'} />
                <Stat label="Per minute (×1,200)" value={formatMB(tPerTick * TICKS_PER_MINUTE) + '/min'} />
                <Stat label="Per hour (×72,000)" value={formatMB(tPerTick * TICKS_PER_HOUR) + '/h'} />
              </div>
            </div>

            {/* D-T Fuel */}
            <div className="result-card">
              <div className="result-card-header">
                <div className="result-dot purple" />
                <span className="result-title">D-T Fuel (mixed)</span>
              </div>
              <div className="stat-rows">
                <Stat label="Per tick" value={`${dtPerTick} mB/t`} cls="highlight purple" />
                <div className="divider" />
                <Stat label="Per second" value={formatMB(dtPerTick * TICKS_PER_SECOND) + '/s'} />
                <Stat label="Per minute" value={formatMB(dtPerTick * TICKS_PER_MINUTE) + '/min'} />
                <Stat label="Per hour" value={formatMB(dtPerTick * TICKS_PER_HOUR) + '/h'} />
              </div>
            </div>

            {/* Energy */}
            <div className="result-card">
              <div className="result-card-header">
                <div className="result-dot orange" />
                <span className="result-title">
                  Energy output {cooling === 'water' ? '(turbine + direct)' : '(air-cooled)'}
                </span>
              </div>
              <div className="stat-rows">
                <Stat label="Per tick" value={formatFE(internalFE) + '/t'} cls="highlight orange" />
                <div className="divider" />
                <Stat label="Per second" value={formatFE(internalFE * TICKS_PER_SECOND) + '/s'} />
                <Stat label="Per minute" value={formatFE(internalFE * TICKS_PER_MINUTE) + '/min'} />
                <Stat label="Per hour" value={formatFE(internalFE * TICKS_PER_HOUR) + '/h'} />
              </div>
            </div>

          </div>

          {/* Water-cooled breakdown */}
          {cooling === 'water' && (
            <div className="result-card" style={{ marginBottom: 12 }}>
              <div className="result-card-header">
                <div className="result-dot blue" />
                <span className="result-title">Water-cooled breakdown — injection rate {injectionRate}</span>
              </div>
              <div className="stat-rows">
                <Stat label="Reactor direct output (heat → FE)" value={`${formatFE(waterReactorFE)}/t`} />
                <Stat label="High-efficiency Industrial Turbine" value={`${formatFE(waterTurbineFE)}/t`} />
                <div className="divider" />
                <Stat label="Combined total" value={`${formatFE(waterTotalFE)}/t`} cls="highlight orange" />
              </div>
              <div className="cooling-note" style={{ marginTop: 12 }}>
                ⚠ Requires an injection rate ≥ 4. Below that, the reactor behaves like air-cooled.
              </div>
            </div>
          )}

          {cooling === 'air' && (
            <div className="explanation" style={{ marginBottom: 20 }}>
              <strong>Note:</strong> switching to water-cooled at the same rate would yield{' '}
              <Inline>{formatFE(waterTotalFE)}/t</Inline> (×
              {(waterTotalFE / airFE).toFixed(2)} more efficient).
            </div>
          )}
        </>
      ) : (
        /* Direct injection results */
        <div className="results-grid">
          <div className="result-card">
            <div className="result-card-header">
              <div className="result-dot purple" />
              <span className="result-title">D-T Fuel consumed</span>
            </div>
            <div className="stat-rows">
              <Stat label="Per tick" value={`${directDT} mB/t`} cls="highlight purple" />
              <div className="divider" />
              <Stat label="Per second" value={formatMB(directDT * TICKS_PER_SECOND) + '/s'} />
              <Stat label="Per minute" value={formatMB(directDT * TICKS_PER_MINUTE) + '/min'} />
              <Stat label="Per hour" value={formatMB(directDT * TICKS_PER_HOUR) + '/h'} />
            </div>
          </div>

          <div className="result-card">
            <div className="result-card-header">
              <div className="result-dot orange" />
              <span className="result-title">Energy output</span>
            </div>
            <div className="stat-rows">
              <Stat label="Per tick" value={formatFE(directFE) + '/t'} cls="highlight orange" />
              <div className="divider" />
              <Stat label="Per second" value={formatFE(directFE * TICKS_PER_SECOND) + '/s'} />
              <Stat label="Per minute" value={formatFE(directFE * TICKS_PER_MINUTE) + '/min'} />
              <Stat label="Per hour" value={formatFE(directFE * TICKS_PER_HOUR) + '/h'} />
            </div>
          </div>

          <div className="result-card full-width">
            <div className="result-card-header">
              <div className="result-dot blue" />
              <span className="result-title">
                Upstream D &amp; T requirements (for {directDT} mB/t of D-T Fuel)
              </span>
            </div>
            <div className="stat-rows">
              <Stat label="Deuterium required / tick" value={`${directDT} mB/t`} />
              <Stat label="Tritium required / tick" value={`${directDT} mB/t`} />
              <div className="divider" />
              <Stat label="Deuterium / hour" value={formatMB(directDT * TICKS_PER_HOUR) + '/h'} />
              <Stat label="Tritium / hour" value={formatMB(directDT * TICKS_PER_HOUR) + '/h'} />
            </div>
          </div>
        </div>
      )}

      {/* ── Formulas & Mechanics ── */}
      <div className="info-section">
        <h2>Formulas &amp; Mechanics</h2>

        {isInternal && (
          <div className="formula-card">
            <h3>1. Fuel consumption (internal mixing)</h3>
            <p>
              The injection rate is an <strong>even integer</strong> (2, 4, 6…98).
              Every tick, the reactor draws equal volumes of Deuterium and Tritium,
              then fuses them in the plasma chamber.
            </p>
            <FormulaBlock>{`Deuterium / tick  =  injection_rate ÷ 2   [mB/t]
Tritium   / tick  =  injection_rate ÷ 2   [mB/t]
D-T Fuel  / tick  =  injection_rate ÷ 2   [mB/t]
  ( 1 mB D  +  1 mB T  →  1 mB D-T Fuel )

Examples:
  rate =  2  →  1 mB/t each  →  1 mB/t D-T
  rate = 10  →  5 mB/t each  →  5 mB/t D-T
  rate = 98  → 49 mB/t each  → 49 mB/t D-T`}</FormulaBlock>
            <p>
              Only even rates are allowed because each injection "unit" corresponds to
              0.5 mB of each component. Odd values are not selectable in the in-game GUI.
            </p>
          </div>
        )}

        {isInternal && cooling === 'air' && (
          <div className="formula-card">
            <h3>2. Energy output — Air-cooled</h3>
            <p>
              Without water inside the structure, all plasma heat is converted directly
              into Forge Energy (FE). This is the simplest setup: only 3 Reactor Ports
              are needed (1 Deuterium, 1 Tritium, 1 energy output).
            </p>
            <FormulaBlock>{`FE/t (air-cooled)  =  injection_rate × 200,000

  rate =  2  →    400,000 FE/t   (400 kFE/t)
  rate = 10  →  2,000,000 FE/t   (  2 MFE/t)
  rate = 50  → 10,000,000 FE/t   ( 10 MFE/t)
  rate = 98  → 19,600,000 FE/t   (19.6 MFE/t)

Efficiency: 400,000 FE per mB of D-T Fuel burned`}</FormulaBlock>
            <p>
              The relationship is perfectly linear: doubling the injection rate
              doubles both fuel consumption and energy output.
            </p>
          </div>
        )}

        {isInternal && cooling === 'water' && (
          <div className="formula-card">
            <h3>2. Energy output — Water-cooled</h3>
            <p>
              When water is present inside the structure, excess plasma heat vaporises
              it into pressurised steam. That steam is routed to a high-efficiency{' '}
              <strong>Industrial Turbine</strong>, which generates most of the energy.
              Minimum injection rate required: <strong>4</strong> (below that, there
              is not enough heat to vaporise water).
            </p>
            <FormulaBlock>{`FE/t reactor direct  =  injection_rate ×  50,000
FE/t turbine         =  injection_rate × 427,500
────────────────────────────────────────────────
FE/t total           =  injection_rate × 477,500

  rate =  4  →  1,910,000 FE/t  (1.91 MFE/t)
  rate = 10  →  4,775,000 FE/t  (4.78 MFE/t)
  rate = 50  → 23,875,000 FE/t  (23.9 MFE/t)
  rate = 98  → 46,795,000 FE/t  (≈46.8 MFE/t)

Gain vs air-cooled: ×2.39 at the same injection rate`}</FormulaBlock>
            <p>
              The Industrial Turbine must be built with enough Turbine Blades and
              Electromagnetic Coils to handle the full steam throughput. A bottleneck
              on the turbine side will reduce overall efficiency.
            </p>
          </div>
        )}

        {!isInternal && (
          <div className="formula-card">
            <h3>1. Direct injection of pre-mixed D-T Fuel</h3>
            <p>
              D-T Fuel can be produced outside the reactor in a{' '}
              <strong>Chemical Infuser</strong> at a 1:1 ratio, then injected directly.
              This fuel <strong>bypasses the controller's injection rate</strong> and
              is burned immediately as it arrives.
            </p>
            <FormulaBlock>{`FE/t  =  dt_fuel_mBt × 400,000

Cap: 1,000 mB/t  →  400,000,000 FE/t  (400 GFE/t !)

Upstream requirements:
  dt_fuel_mBt mB/t of Deuterium
  dt_fuel_mBt mB/t of Tritium
  (1:1 ratio in the Chemical Infuser)`}</FormulaBlock>
            <p>
              This method is rarely used as it requires a massively oversized production
              chain. It is reserved for endgame setups that need extreme amounts of power.
            </p>
          </div>
        )}

        <div className="formula-card">
          <h3>{isInternal ? '3' : '2'}. Time conversions</h3>
          <p>
            Minecraft runs at <strong>20 ticks per second</strong>. All per-tick
            values multiply by these factors:
          </p>
          <FormulaBlock>{`1 second  =     20 ticks
1 minute  =  1,200 ticks
1 hour    = 72,000 ticks

Example (rate 2, air-cooled, 1 mB/t D-T Fuel):
  Energy  : 400,000 FE/t × 20     =    8,000,000 FE/s
  Fuel    :       1 mB/t × 1,200  =        1,200 mB/min
  Fuel    :       1 mB/t × 72,000 =       72,000 mB/h`}</FormulaBlock>
        </div>

        <div className="formula-card">
          <h3>{isInternal ? '4' : '3'}. Startup — Ignition</h3>
          <p>
            The reactor does not start on its own. Two ignition methods are available:
          </p>
          <p>
            <strong>Laser method (v9 and v10):</strong> a Laser Amplifier fires an
            energy pulse into the <em>Laser Focus Matrix</em> (centre block of one
            face). A <em>Hohlraum</em> filled with D-T Fuel must be placed in the
            Fusion Controller's item slot before firing.
          </p>
          <p>
            <strong>Resistive Heater method (v10 only):</strong> a Resistive Heater
            set to <Inline>10,000,000 FE/t</Inline> heats the reactor to ignition
            temperature. The Hohlraum is still required. The Laser Focus Matrix can
            be omitted and replaced by an extra Reactor Port used to inject heat.
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="footer">
        <NavLinks className="nav-links nav-links--footer" />
      </footer>
    </div>
  )
}
