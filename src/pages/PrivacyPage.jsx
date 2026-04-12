import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  return (
    <div className="privacy-page">
      <div className="privacy-inner">

        <div className="privacy-header">
          <Link to="/" className="privacy-back">← Back to My Club Locator</Link>
          <div className="privacy-logo">
            <div className="privacy-logo-pin">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#fff"/>
              </svg>
            </div>
            <span>My Club Locator</span>
          </div>
        </div>

        <div className="privacy-card">
          <h1 className="privacy-title">Privacy & Use Policy</h1>
          <p className="privacy-updated">Last updated: April 2026</p>
          <p className="privacy-intro">
            By using My Club Locator, you agree to the terms outlined on this page. Please read carefully before registering or using the platform.
          </p>

          <div className="privacy-section">
            <h2>1. About this platform</h2>
            <p>
              My Club Locator is an independent platform operated by Nemecek Enterprises Inc. It is designed exclusively for independently owned nutrition club operators within an authorized network.
            </p>
            <p>
              <strong>Herbalife disclaimer:</strong> My Club Locator is in no way affiliated with, endorsed by, sponsored by, or connected to Herbalife Nutrition Ltd. or any of its subsidiaries, affiliates, or representatives. Herbalife bears no responsibility for the accuracy, completeness, availability, or use of any information found on this platform. Any reference to nutrition clubs, club operations, or related activities does not imply Herbalife's involvement or approval.
            </p>
            <p>
              <strong>Nemecek Enterprises Inc. disclaimer:</strong> Nemecek Enterprises Inc. is not liable for any misinformation, errors, omissions, or inaccurate content posted by platform members. Member-submitted content, including club names, addresses, hours, photos, and contact information, is the sole responsibility of the member who submitted it.
            </p>
          </div>

          <div className="privacy-section">
            <h2>2. Terms of use</h2>
            <p>By accessing and using My Club Locator, you agree to the following:</p>
            <ul>
              <li>You are an independently operating nutrition club owner or operator.</li>
              <li>You have been onboarded by a verified upline sponsor within the authorized network. My Club Locator is not responsible for verifying sponsor relationships or resolving disputes between members and their uplines or downlines.</li>
              <li>You will keep your club profile accurate, current, and complete.</li>
              <li>You will not share, distribute, or misuse the contact information, location data, or personal information of other platform members outside of this network.</li>
              <li>You will not use this platform for any purpose other than managing and discovering nutrition club locations within the authorized network.</li>
              <li>You acknowledge that this is a private, members-only platform and agree not to share access credentials or platform content publicly.</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h2>3. Privacy & data</h2>
            <p>
              We store the information you provide during registration and profile setup, including your name, email address, club name, address, hours of operation, phone number, social media links, and uploaded photos. This information is used solely to power the club locator map and directory visible to other registered members.
            </p>
            <p>
              We do not sell, share, or distribute your personal information to any third parties. We do not use advertising cookies or share usage data with external analytics providers. Basic platform analytics may be collected to improve performance and user experience.
            </p>
            <p>
              Your club profile information — including your name, club address, hours, and contact details — is visible to other registered and approved members of this platform. It is not publicly visible to unauthenticated visitors.
            </p>
          </div>

          <div className="privacy-section">
            <h2>4. Member removal policy</h2>
            <p>
              My Club Locator and Nemecek Enterprises Inc. reserve the right to suspend or permanently remove any member account at our discretion, including but not limited to cases where a member:
            </p>
            <ul>
              <li>Violates any term of this policy</li>
              <li>Submits false, misleading, or inaccurate club information</li>
              <li>Misuses, distributes, or exploits other members' personal data</li>
              <li>Engages in conduct harmful to the network or its members</li>
              <li>Is no longer an active and authorized member of the network</li>
            </ul>
            <p>Removal may occur without prior notice. Removed members forfeit access to the platform and all associated data.</p>
          </div>

          <div className="privacy-section">
            <h2>5. Data retention & deletion</h2>
            <p>
              We retain your club profile, contact information, and uploaded media for as long as your account remains active on the platform. If your account is removed by an administrator or at your request, your data will be deleted from the platform within 30 days of removal.
            </p>
            <p>
              To request account deletion or data removal, contact us at <a href="mailto:support@myclublocator.com">support@myclublocator.com</a>. Please include your registered email address and club name in your request.
            </p>
          </div>

          <div className="privacy-section">
            <h2>6. Cookie & analytics notice</h2>
            <p>
              This platform does not use advertising cookies or share your data with third-party advertisers. We may use minimal, privacy-respecting analytics to understand platform usage and improve the experience for members. No personally identifiable information is shared with analytics providers.
            </p>
          </div>

          <div className="privacy-section">
            <h2>7. Contact</h2>
            <p>
              For questions about this policy, to report a concern, or to request data deletion, please contact us at:
            </p>
            <div className="privacy-contact-block">
              <div className="privacy-contact-row">
                <strong>Email:</strong>
                <a href="mailto:support@myclublocator.com">support@myclublocator.com</a>
              </div>
              <div className="privacy-contact-row">
                <strong>Platform:</strong>
                <span>My Club Locator — myclublocator.com</span>
              </div>
              <div className="privacy-contact-row">
                <strong>Operated by:</strong>
                <span>Nemecek Enterprises Inc.</span>
              </div>
            </div>
          </div>

          <div className="privacy-footer-note">
            By using My Club Locator, you confirm that you have read, understood, and agree to this Privacy & Use Policy.
          </div>
        </div>

        <div className="privacy-page-footer">
          <Link to="/">← Back to My Club Locator</Link>
          <span>© {new Date().getFullYear()} Nemecek Enterprises Inc.</span>
        </div>

      </div>
    </div>
  )
}
