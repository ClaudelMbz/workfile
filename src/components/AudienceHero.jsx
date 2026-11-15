import { useMemo, useState } from 'react'
import { computeAudience } from '../utils/audience'
import Sparkline from './Sparkline'

const PERIODS = [
  { days: 1, label: 'Hier', since: "depuis hier" },
  { days: 7, label: '7 j', since: 'en 7 jours' },
  { days: 30, label: '30 j', since: 'en 30 jours' },
]

const STORAGE_KEY = 'audiencePeriod'

function loadPeriod() {
  try {
    const days = Number(localStorage.getItem(STORAGE_KEY))
    return PERIODS.some((p) => p.days === days) ? days : 1
  } catch {
    return 1
  }
}

function formatNumber(n) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

// Le chiffre qui compte : l'audience totale, en très grand, et de combien
// elle a bougé sur la période choisie.
export default function AudienceHero({ workers, objectiveTypes }) {
  const [days, setDays] = useState(loadPeriod)
  const audience = useMemo(() => computeAudience(workers, objectiveTypes, days), [workers, objectiveTypes, days])

  if (!audience) return null

  function choose(d) {
    setDays(d)
    try {
      localStorage.setItem(STORAGE_KEY, String(d))
    } catch {
      // stockage indisponible : le choix vaut juste pour cette visite
    }
  }

  const period = PERIODS.find((p) => p.days === days)
  const trend = audience.gain > 0 ? 'up' : audience.gain < 0 ? 'down' : 'flat'

  return (
    <section className="audience-hero" aria-label="Audience totale">
      <div className="audience-hero-main">
        <div className="audience-hero-top">
          <span className="audience-hero-label">Audience totale</span>
          <div className="audience-hero-periods" role="group" aria-label="Comparer avec">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                className={days === p.days ? 'active' : ''}
                onClick={() => choose(p.days)}
                aria-pressed={days === p.days}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="audience-hero-value">{formatNumber(audience.total)}</div>

        <div className="audience-hero-change">
          <span className={`audience-hero-delta ${trend}`}>
            {trend === 'up' ? '▲ +' : trend === 'down' ? '▼ ' : ''}
            {trend === 'flat' ? '– stable' : formatNumber(audience.gain)}
            {audience.pct != null && trend !== 'flat' && (
              <> ({audience.gain > 0 ? '+' : ''}{audience.pct.toFixed(1).replace('.', ',')} %)</>
            )}
          </span>
          <span className="audience-hero-since">
            {period.since} · avant : {formatNumber(audience.before)}
          </span>
        </div>

        <p className="audience-hero-note">
          {audience.accounts} compte{audience.accounts !== 1 ? 's' : ''} suivi
          {audience.accounts !== 1 ? 's' : ''}, tous réseaux confondus
        </p>
      </div>

      <div className="audience-hero-chart">
        <Sparkline data={audience.series} width={260} height={72} />
      </div>
    </section>
  )
}
