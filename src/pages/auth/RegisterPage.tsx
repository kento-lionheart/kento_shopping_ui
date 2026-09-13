import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as authApi from '@/api/auth';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fieldInputClass =
  'border-white/20 text-white placeholder:text-white/40 focus-visible:border-cta focus-visible:ring-cta/30';

type FieldName = 'fullName' | 'email' | 'phoneNumber' | 'password' | 'confirmPassword';

type FieldErrors = Partial<Record<FieldName, string>>;

const PHONE_PATTERN = /^[0-9]{10,11}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_HAS_DIGIT = /[0-9]/;

function validate(values: {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}): FieldErrors {
  const errors: FieldErrors = {};

  const fullName = values.fullName.trim();
  if (fullName.length < 2 || fullName.length > 100) {
    errors.fullName = 'Full name is required';
  }

  const email = values.email.trim();
  if (!email || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Please enter a valid email';
  }

  const phoneNumber = values.phoneNumber.trim();
  if (!PHONE_PATTERN.test(phoneNumber)) {
    errors.phoneNumber = 'Please enter a valid phone number';
  }

  if (values.password.length < 8 || !PASSWORD_HAS_DIGIT.test(values.password)) {
    errors.password = 'Password must be at least 8 characters and contain a number';
  }

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return errors;
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = validate({ fullName, email, phoneNumber, password, confirmPassword });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.register({ fullName, email, phoneNumber, password, confirmPassword });
      navigate('/login', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFieldErrors((prev) => ({ ...prev, email: err.message }));
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#2A0F0A] to-[#4a1c10] px-4 py-8">
      <Card className="w-full max-w-sm border-white/10 bg-[rgba(42,15,10,0.6)] shadow-2xl backdrop-blur-2xl backdrop-saturate-150">
        <CardHeader>
          <p className="text-xs font-medium tracking-[0.3em] text-cta uppercase">Kento</p>
          <CardTitle className="font-heading text-3xl font-medium text-white">Register</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {/* red-400, not text-destructive: the token's #DC2626 fails contrast on this dark glass card */}
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName" className="text-white/80">
                Full name
              </Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                aria-invalid={fieldErrors.fullName ? true : undefined}
                aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
                className={fieldInputClass}
              />
              {fieldErrors.fullName && (
                <p id="fullName-error" role="alert" className="text-sm text-red-400">
                  {fieldErrors.fullName}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-white/80">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                className={fieldInputClass}
              />
              {fieldErrors.email && (
                <p id="email-error" role="alert" className="text-sm text-red-400">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="phoneNumber" className="text-white/80">
                Phone number
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                autoComplete="tel"
                aria-invalid={fieldErrors.phoneNumber ? true : undefined}
                aria-describedby={fieldErrors.phoneNumber ? 'phoneNumber-error' : undefined}
                className={fieldInputClass}
              />
              {fieldErrors.phoneNumber && (
                <p id="phoneNumber-error" role="alert" className="text-sm text-red-400">
                  {fieldErrors.phoneNumber}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-white/80">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className={fieldInputClass}
              />
              {fieldErrors.password && (
                <p id="password-error" role="alert" className="text-sm text-red-400">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-white/80">
                Confirm password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                className={fieldInputClass}
              />
              {fieldErrors.confirmPassword && (
                <p id="confirmPassword-error" role="alert" className="text-sm text-red-400">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 bg-cta text-cta-foreground hover:bg-cta/90"
            >
              {isSubmitting ? 'Registering…' : 'Register'}
            </Button>

            <p className="text-center text-sm text-white/60">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-cta hover:underline">
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
