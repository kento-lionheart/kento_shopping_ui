import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/client';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await authApi.register({ fullName, email, phoneNumber, password, confirmPassword });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Register</h1>

      {error && <p role="alert">{error}</p>}

      <label htmlFor="fullName">Full name</label>
      <input
        id="fullName"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
        autoComplete="name"
      />

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      <label htmlFor="phoneNumber">Phone number</label>
      <input
        id="phoneNumber"
        type="tel"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        required
        autoComplete="tel"
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
      />

      <label htmlFor="confirmPassword">Confirm password</label>
      <input
        id="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
      />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Registering…' : 'Register'}
      </button>

      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
