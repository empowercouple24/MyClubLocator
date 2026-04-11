import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Supabase sends a confirmation email by default.
      // For internal apps you can disable email confirmation in Supabase dashboard:
      // Authentication > Settings > Enable email confirmations (toggle off)
      navigate('/map')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create your account</h1>
        <p className="sub">Register your nutrition club and appear on the member map.</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Create a password (min. 6 characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button className="btn-full" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account & continue'}
          </button>
        </form>

        <div className="auth-toggle">
          Already registered? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  )
}
