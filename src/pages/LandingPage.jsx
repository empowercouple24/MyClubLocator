import { useNavigate } from 'react-router-dom'

function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#fff"/>
    </svg>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="landing-page">
      <div className="landing-inner">

        {/* Logo */}
        <div className="landing-logo">
          <div className="landing-logo-pin"><PinIcon /></div>
          <span className="landing-logo-text">My Club Locator</span>
        </div>

        {/* Headline */}
        <h1 className="landing-headline">Welcome to My Club Locator</h1>
        <p className="landing-sub">
          The private locator for independently owned nutrition clubs.
          Find clubs, explore markets, and manage your location.
        </p>

        {/* Cards */}
        <div className="landing-cards">

          {/* Returning */}
          <div className="landing-card landing-card--returning">
            <span className="landing-badge landing-badge--returning">Returning member</span>
            <h2 className="landing-card-title">Good to have you back</h2>
            <p className="landing-card-desc">
              Your club is on the map. Log in to update your hours, photos, and club details.
            </p>
            <ul className="landing-perks">
              <li><span className="landing-perk-dot landing-perk-dot--green"></span>Manage your club profile</li>
              <li><span className="landing-perk-dot landing-perk-dot--green"></span>View market data near you</li>
              <li><span className="landing-perk-dot landing-perk-dot--green"></span>Browse the full directory</li>
            </ul>
            <button className="landing-btn landing-btn--green" onClick={() => navigate('/login')}>
              Log in to my account
            </button>
          </div>

          {/* New */}
          <div className="landing-card landing-card--new">
            <span className="landing-badge landing-badge--new">New member</span>
            <h2 className="landing-card-title">Put your club on the map</h2>
            <p className="landing-card-desc">
              Join the network, add your location, and connect with club owners across the country.
            </p>
            <ul className="landing-perks">
              <li><span className="landing-perk-dot landing-perk-dot--indigo"></span>Get discovered by your network</li>
              <li><span className="landing-perk-dot landing-perk-dot--indigo"></span>Explore nearby club density</li>
              <li><span className="landing-perk-dot landing-perk-dot--indigo"></span>Free — takes under a minute</li>
            </ul>
            <button className="landing-btn landing-btn--indigo" onClick={() => navigate('/signup')}>
              Create my free account
            </button>
          </div>

        </div>

        <p className="landing-footer">
          Questions? Contact your upline or reach out to your network admin.
        </p>

      </div>
    </div>
  )
}
