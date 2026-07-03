import { useState, useCallback } from 'react'
import './App.css'

// ─── Constants from the Mekanism wiki ───────────────────────────────────────
const MIN_INJECTION = 2
const MAX_INJECTION = 98      // internal mixing cap
const MAX_DT_DIRECT = 1000    // direct D-T Fuel injection cap (mB/t)

// Air-cooled: injection_rate × 200 000 FE/t
// Dérivé : rate=2 → 400k FE/t ; rate=98 → 19.6M FE/t
const AIR_COOLED_COEFF = 200_000

// Water-cooled (Industrial Turbine haute efficacité) :
//   réacteur direct : rate × 50 000 FE/t
//   turbine         : rate × 427 500 FE/t
//   total           : rate × 477 500 FE/t
// Dérivé : rate=4 → 1.91M total ; rate=98 → 46.8M total
const WATER_REACTOR_COEFF = 50_000
const WATER_TURBINE_COEFF = 427_500

// Injection directe D-T Fuel : 400 000 FE par mB/t de D-T Fuel
const DT_DIRECT_ENERGY_PER_MB = 400_000

const TICKS_PER_SECOND = 20
const TICKS_PER_MINUTE = 1_200
const TICKS_PER_HOUR = 72_000

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatFE(fe) {
  if (fe >= 1e9) return `${(fe / 1e9).toLocaleString('fr', { maximumFractionDigits: 2 })} GFE`
  if (fe >= 1e6) return `${(fe / 1e6).toLocaleString('fr', { maximumFractionDigits: 2 })} MFE`
  if (fe >= 1e3) return `${(fe / 1e3).toLocaleString('fr', { maximumFractionDigits: 1 })} kFE`
  return `${fe.toLocaleString('fr')} FE`
}

function formatMB(mb) {
  if (mb >= 1_000_000) return `${(mb / 1_000_000).toLocaleString('fr', { maximumFractionDigits: 2 })} kB`
  return `${mb.toLocaleString('fr', { maximumFractionDigits: 1 })} mB`
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

// ─── Main component ──────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState('internal')  // 'internal' | 'direct'
  const [cooling, setCooling] = useState('air') // 'air' | 'water'
  const [injectionRate, setInjectionRate] = useState(2)
  const [dtDirect, setDtDirect] = useState(2)

  // ── Valeurs dérivées — mixage interne ─────────────────────────────────────
  const dPerTick = injectionRate / 2
  const tPerTick = injectionRate / 2
  const dtPerTick = injectionRate / 2

  const airFE = injectionRate * AIR_COOLED_COEFF
  const waterReactorFE = injectionRate * WATER_REACTOR_COEFF
  const waterTurbineFE = injectionRate * WATER_TURBINE_COEFF
  const waterTotalFE = waterReactorFE + waterTurbineFE

  const internalFE = cooling === 'air' ? airFE : waterTotalFE

  // ── Valeurs dérivées — injection directe ─────────────────────────────────
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
        <h1><span className="icon">⚛</span> Mekanism Fusion Reactor — Calculateur de carburant</h1>
        <p>
          Calcule la consommation de D-T Fuel et la production d'énergie selon le taux
          d'injection. Données issues du wiki FTB — Mekanism v9 / v10.
        </p>
      </header>

      {/* ── Sélecteur de mode ── */}
      <div className="mode-selector">
        <div className="mode-label">Mode d'injection</div>
        <div className="mode-tabs">
          <button
            className={`mode-tab ${mode === 'internal' ? 'active' : ''}`}
            onClick={() => setMode('internal')}
          >
            Mixage interne (D + T)
          </button>
          <button
            className={`mode-tab ${mode === 'direct' ? 'active' : ''}`}
            onClick={() => setMode('direct')}
          >
            D-T Fuel pré-mixé (injection directe)
          </button>
        </div>
      </div>

      {/* ── Paramètres ── */}
      <div className="card">
        <div className="card-title">Paramètres</div>

        {isInternal ? (
          <>
            {/* Sélecteur de refroidissement */}
            <div style={{ marginBottom: 20 }}>
              <div className="mode-label" style={{ marginBottom: 8 }}>Refroidissement</div>
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

            {/* Slider injection rate */}
            <div className="injection-control">
              <div className="injection-header">
                <span className="injection-label">Injection Rate</span>
                <span className="injection-value">
                  {injectionRate}
                  <span className="injection-unit">({dPerTick} mB/t × 2 composants)</span>
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
                  <span className="slider-bound">Min : 2</span>
                  <span className="slider-bound">Max : 98</span>
                </div>
              </div>

              <div className="explanation">
                <strong>Comment fonctionne l'injection rate ?</strong><br />
                La valeur réglable dans l'onglet <em>Fuel</em> du Reactor Controller
                détermine la vitesse à laquelle le D-T Fuel est mixé et injecté dans
                la chambre de plasma. Elle doit être un entier <strong>pair</strong> (2, 4, 6…
                jusqu'à 98).<br /><br />
                À chaque tick de jeu (1/20 de seconde), le réacteur consomme :
                <ul>
                  <li><span className="formula">injection_rate ÷ 2</span> mB de Deutérium</li>
                  <li><span className="formula">injection_rate ÷ 2</span> mB de Tritium</li>
                </ul>
                Le mélange 1:1 donne autant de mB de D-T Fuel qu'il y a de mB de chaque composant.
              </div>
            </div>
          </>
        ) : (
          <div className="injection-control">
            <div className="injection-header">
              <span className="injection-label">Débit de D-T Fuel injecté directement</span>
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
                <span className="slider-bound">Min : 1</span>
                <span className="slider-bound">Max : {MAX_DT_DIRECT}</span>
              </div>
            </div>

            <div className="explanation">
              <strong>Injection directe de D-T Fuel pré-mixé</strong><br />
              Le D-T Fuel peut être préparé dans un <em>Chemical Infuser</em>
              (ratio 1 mB D + 1 mB T → 1 mB D-T Fuel) et acheminé directement
              dans le réacteur via un Reactor Port. Ce carburant est brûlé
              immédiatement, <strong>sans tenir compte de l'injection rate</strong>
              du contrôleur.<br /><br />
              Cette méthode permet de dépasser largement le plafond interne de
              49 mB/t, jusqu'à <strong>{MAX_DT_DIRECT} mB/t</strong> maximum.
              <ul>
                <li>Taux actuel : <span className="formula">{directDT} mB/t</span></li>
                <li>
                  Énergie : <span className="formula">{directDT} × 400 000 = {(directFE / 1e6).toFixed(0)} MFE/t</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ── Résultats ── */}
      {isInternal ? (
        <>
          <div className="results-grid">

            {/* Deutérium */}
            <div className="result-card">
              <div className="result-card-header">
                <div className="result-dot blue" />
                <span className="result-title">Deutérium (D)</span>
              </div>
              <div className="stat-rows">
                <Stat label="Par tick" value={`${dPerTick} mB/t`} cls="highlight" />
                <div className="divider" />
                <Stat label="Par seconde (×20)" value={formatMB(dPerTick * TICKS_PER_SECOND) + '/s'} />
                <Stat label="Par minute (×1 200)" value={formatMB(dPerTick * TICKS_PER_MINUTE) + '/min'} />
                <Stat label="Par heure (×72 000)" value={formatMB(dPerTick * TICKS_PER_HOUR) + '/h'} />
              </div>
            </div>

            {/* Tritium */}
            <div className="result-card">
              <div className="result-card-header">
                <div className="result-dot green" />
                <span className="result-title">Tritium (T)</span>
              </div>
              <div className="stat-rows">
                <Stat label="Par tick" value={`${tPerTick} mB/t`} cls="highlight green" />
                <div className="divider" />
                <Stat label="Par seconde (×20)" value={formatMB(tPerTick * TICKS_PER_SECOND) + '/s'} />
                <Stat label="Par minute (×1 200)" value={formatMB(tPerTick * TICKS_PER_MINUTE) + '/min'} />
                <Stat label="Par heure (×72 000)" value={formatMB(tPerTick * TICKS_PER_HOUR) + '/h'} />
              </div>
            </div>

            {/* D-T Fuel */}
            <div className="result-card">
              <div className="result-card-header">
                <div className="result-dot purple" />
                <span className="result-title">D-T Fuel (mixé)</span>
              </div>
              <div className="stat-rows">
                <Stat label="Par tick" value={`${dtPerTick} mB/t`} cls="highlight purple" />
                <div className="divider" />
                <Stat label="Par seconde" value={formatMB(dtPerTick * TICKS_PER_SECOND) + '/s'} />
                <Stat label="Par minute" value={formatMB(dtPerTick * TICKS_PER_MINUTE) + '/min'} />
                <Stat label="Par heure" value={formatMB(dtPerTick * TICKS_PER_HOUR) + '/h'} />
              </div>
            </div>

            {/* Énergie */}
            <div className="result-card">
              <div className="result-card-header">
                <div className="result-dot orange" />
                <span className="result-title">
                  Énergie {cooling === 'water' ? '(turbine + direct)' : '(air-cooled)'}
                </span>
              </div>
              <div className="stat-rows">
                <Stat label="Par tick" value={formatFE(internalFE) + '/t'} cls="highlight orange" />
                <div className="divider" />
                <Stat label="Par seconde" value={formatFE(internalFE * TICKS_PER_SECOND) + '/s'} />
                <Stat label="Par minute" value={formatFE(internalFE * TICKS_PER_MINUTE) + '/min'} />
                <Stat label="Par heure" value={formatFE(internalFE * TICKS_PER_HOUR) + '/h'} />
              </div>
            </div>

          </div>

          {/* Détail water-cooled */}
          {cooling === 'water' && (
            <div className="result-card" style={{ marginBottom: 12 }}>
              <div className="result-card-header">
                <div className="result-dot blue" />
                <span className="result-title">Détail water-cooled — injection rate {injectionRate}</span>
              </div>
              <div className="stat-rows">
                <Stat label="Réacteur direct (chaleur → FE)" value={`${formatFE(waterReactorFE)}/t`} />
                <Stat label="Industrial Turbine haute efficacité" value={`${formatFE(waterTurbineFE)}/t`} />
                <div className="divider" />
                <Stat label="Total combiné" value={`${formatFE(waterTotalFE)}/t`} cls="highlight orange" />
              </div>
              <div className="cooling-note" style={{ marginTop: 12 }}>
                ⚠ Nécessite un taux d'injection ≥ 4. En dessous, le réacteur se comporte comme en air-cooled.
              </div>
            </div>
          )}

          {cooling === 'air' && (
            <div className="explanation" style={{ marginBottom: 20 }}>
              <strong>Note :</strong> en water-cooled au même taux, l'énergie totale serait de{' '}
              <Inline>{formatFE(waterTotalFE)}/t</Inline> (×
              {(waterTotalFE / airFE).toFixed(2)} plus efficace).
            </div>
          )}
        </>
      ) : (
        /* Résultats injection directe */
        <div className="results-grid">
          <div className="result-card">
            <div className="result-card-header">
              <div className="result-dot purple" />
              <span className="result-title">D-T Fuel consommé</span>
            </div>
            <div className="stat-rows">
              <Stat label="Par tick" value={`${directDT} mB/t`} cls="highlight purple" />
              <div className="divider" />
              <Stat label="Par seconde" value={formatMB(directDT * TICKS_PER_SECOND) + '/s'} />
              <Stat label="Par minute" value={formatMB(directDT * TICKS_PER_MINUTE) + '/min'} />
              <Stat label="Par heure" value={formatMB(directDT * TICKS_PER_HOUR) + '/h'} />
            </div>
          </div>

          <div className="result-card">
            <div className="result-card-header">
              <div className="result-dot orange" />
              <span className="result-title">Énergie produite</span>
            </div>
            <div className="stat-rows">
              <Stat label="Par tick" value={formatFE(directFE) + '/t'} cls="highlight orange" />
              <div className="divider" />
              <Stat label="Par seconde" value={formatFE(directFE * TICKS_PER_SECOND) + '/s'} />
              <Stat label="Par minute" value={formatFE(directFE * TICKS_PER_MINUTE) + '/min'} />
              <Stat label="Par heure" value={formatFE(directFE * TICKS_PER_HOUR) + '/h'} />
            </div>
          </div>

          <div className="result-card full-width">
            <div className="result-card-header">
              <div className="result-dot blue" />
              <span className="result-title">
                Besoins amont en D et T (pour {directDT} mB/t de D-T Fuel)
              </span>
            </div>
            <div className="stat-rows">
              <Stat label="Deutérium requis / tick" value={`${directDT} mB/t`} />
              <Stat label="Tritium requis / tick" value={`${directDT} mB/t`} />
              <div className="divider" />
              <Stat label="Deutérium / heure" value={formatMB(directDT * TICKS_PER_HOUR) + '/h'} />
              <Stat label="Tritium / heure" value={formatMB(directDT * TICKS_PER_HOUR) + '/h'} />
            </div>
          </div>
        </div>
      )}

      {/* ── Formules & Explications ── */}
      <div className="info-section">
        <h2>Formules et mécaniques</h2>

        <div className="formula-card">
          <h3>1. Consommation de carburant (mixage interne)</h3>
          <p>
            L'injection rate est un entier <strong>pair</strong> (2, 4, 6…98).
            À chaque tick, le réacteur prélève un volume égal de Deutérium et de
            Tritium, puis les fusionne dans la chambre de plasma.
          </p>
          <FormulaBlock>{`Deutérium / tick  =  injection_rate ÷ 2   [mB/t]
Tritium   / tick  =  injection_rate ÷ 2   [mB/t]
D-T Fuel  / tick  =  injection_rate ÷ 2   [mB/t]
  ( 1 mB D  +  1 mB T  →  1 mB D-T Fuel )

Exemples :
  rate =  2  →  1 mB/t de chaque  →  1 mB/t D-T
  rate = 10  →  5 mB/t de chaque  →  5 mB/t D-T
  rate = 98  → 49 mB/t de chaque  → 49 mB/t D-T`}</FormulaBlock>
          <p>
            Seuls les taux d'injection pairs sont autorisés car chaque "unité"
            d'injection correspond à 0,5 mB de chaque composant. Un taux impair
            n'est pas possible dans l'interface du jeu.
          </p>
        </div>

        <div className="formula-card">
          <h3>2. Production d'énergie — Air-cooled</h3>
          <p>
            Sans eau dans la structure, toute la chaleur du plasma est convertie
            directement en Forge Energy (FE). C'est la configuration la plus
            simple : 3 Reactor Ports suffisent (1 Deutérium, 1 Tritium,
            1 sortie énergie).
          </p>
          <FormulaBlock>{`FE/t (air-cooled)  =  injection_rate × 200 000

  rate =  2  →    400 000 FE/t   (400 kFE/t)
  rate = 10  →  2 000 000 FE/t   (  2 MFE/t)
  rate = 50  → 10 000 000 FE/t   ( 10 MFE/t)
  rate = 98  → 19 600 000 FE/t   (19.6 MFE/t)

Rendement : 400 000 FE par mB de D-T Fuel consommé`}</FormulaBlock>
          <p>
            La relation est parfaitement linéaire : doubler l'injection rate
            double la consommation de carburant ET la production d'énergie.
          </p>
        </div>

        <div className="formula-card">
          <h3>3. Production d'énergie — Water-cooled</h3>
          <p>
            Si de l'eau est présente dans la structure, la chaleur excédentaire du
            plasma vaporise l'eau en vapeur sous pression. Cette vapeur est
            envoyée dans une <strong>Industrial Turbine</strong> (haute efficacité)
            qui produit la majorité de l'énergie. Taux d'injection minimum : <strong>4</strong>
            (en dessous, pas assez de chaleur pour évaporer l'eau).
          </p>
          <FormulaBlock>{`FE/t réacteur direct  =  injection_rate ×  50 000
FE/t turbine          =  injection_rate × 427 500
────────────────────────────────────────────────
FE/t total            =  injection_rate × 477 500

  rate =  4  →  1 910 000 FE/t  (1.91 MFE/t)
  rate = 10  →  4 775 000 FE/t  (4.78 MFE/t)
  rate = 50  → 23 875 000 FE/t  (23.9 MFE/t)
  rate = 98  → 46 795 000 FE/t  (≈46.8 MFE/t)

Gain vs air-cooled : ×2.39 au même taux d'injection`}</FormulaBlock>
          <p>
            L'Industrial Turbine doit être construite avec suffisamment de Turbine
            Blades et Electromagnetic Coils pour absorber tout le flux de vapeur
            produit. Un goulot d'étranglement côté turbine réduira le rendement global.
          </p>
        </div>

        <div className="formula-card">
          <h3>4. Injection directe de D-T Fuel pré-mixé</h3>
          <p>
            Le D-T Fuel peut être produit hors du réacteur dans un{' '}
            <strong>Chemical Infuser</strong> au ratio 1:1, puis injecté directement.
            Ce carburant <strong>ignore l'injection rate</strong> du contrôleur
            et est brûlé immédiatement au rythme où il arrive.
          </p>
          <FormulaBlock>{`FE/t  =  dt_fuel_mBt × 400 000

Plafond : 1 000 mB/t  →  400 000 000 FE/t  (400 GFE/t !)

Besoins amont :
  dt_fuel_mBt mB/t de Deutérium
  dt_fuel_mBt mB/t de Tritium
  (ratio 1:1 dans le Chemical Infuser)`}</FormulaBlock>
          <p>
            Cette méthode n'est pas couramment utilisée car elle exige une chaîne de
            production massive. Elle est réservée aux configurations
            endgame nécessitant des quantités d'énergie extrêmes.
          </p>
        </div>

        <div className="formula-card">
          <h3>5. Conversions temporelles</h3>
          <p>
            Minecraft tourne à <strong>20 ticks par seconde</strong>. Toutes les
            valeurs /t se multiplient par ces facteurs :
          </p>
          <FormulaBlock>{`1 seconde  =     20 ticks
1 minute   =  1 200 ticks
1 heure    = 72 000 ticks

Exemple (rate 2, air-cooled, 1 mB/t D-T Fuel) :
  Énergie  : 400 000 FE/t × 20    =       8 000 000 FE/s
  Carburant:       1 mB/t  × 1200 =       1 200 mB/min
  Carburant:       1 mB/t  × 72000=      72 000 mB/h`}</FormulaBlock>
        </div>

        <div className="formula-card">
          <h3>6. Démarrage — Ignition</h3>
          <p>
            Le réacteur ne s'allume pas seul. Deux méthodes existent :
          </p>
          <p>
            <strong>Méthode Laser (v9 et v10) :</strong> un Laser Amplifier tire
            une impulsion dans la <em>Laser Focus Matrix</em> (face centrale
            du réacteur). Un <em>Hohlraum</em> rempli de D-T Fuel doit être placé
            dans le slot du Fusion Controller avant le tir.
          </p>
          <p>
            <strong>Méthode Resistive Heater (v10 uniquement) :</strong> un
            Resistive Heater réglé à <Inline>10 000 000 FE/t</Inline> chauffe le
            réacteur jusqu'à la température d'ignition. Le Hohlraum est toujours
            requis. La Laser Focus Matrix peut être omise, remplacée par un
            Reactor Port supplémentaire pour injecter la chaleur.
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="footer">
        <a href="https://ftb.fandom.com/wiki/Fusion_Reactor_(Mekanism)" target="_blank" rel="noreferrer">
          Wiki FTB
        </a>
        <span className="footer-sep">·</span>
        <a href="https://www.curseforge.com/minecraft/mc-mods/mekanism" target="_blank" rel="noreferrer">
          Mekanism (CurseForge)
        </a>
        <span className="footer-sep">·</span>
        <a href="https://github.com/Lauwed/mekanism-fission-reactor-calculator" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  )
}
