import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import styles from './LoginPage.module.css';
import { PersonaQuickSignIn } from './components/PersonaQuickSignIn';
import type { PersonaCard } from './components/personaCards';

import {
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  LoaderIcon,
  ScrumoothIcon,
} from '@/components/common/Icons';
import { ErrorMessage } from '@/components/ErrorMessage';
import { useApiError } from '@/hooks';
import { apiService } from '@/services';
import { useAuthStore, useSessionStore, useTeamStore } from '@/store';
import { logger } from '@/utils/logger';
import { getCurrentPath } from '@/utils/navigation';
import type { LoginCredentials, RegistrationPolicy, User } from '@/types';
import { getUserFriendlyErrorMessage, type ErrorDetails } from '@/utils/authErrors';
import { syncLocaleFromUser, useI18nStore } from '@/i18n/useI18nStore';

type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

/** The session limits the API returns alongside a successful sign-in. */
type AuthenticatedSessionInfo = {
  expiresAt: string;
  idleTimeoutMs: number;
  absoluteTimeoutMs: number;
  warningThresholdMs: number;
};

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'weak';
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 3) return 'fair';
  if (score <= 4) return 'good';
  return 'strong';
}

/**
 * Detects a registration rejection caused by the email domain restriction.
 * Matches the backend's localized message(s) for `validation:auth.emailDomainNotAllowed`.
 */
const isDomainNotAllowedError = (backendMessage: string | undefined): boolean => {
  if (!backendMessage) return false;
  const lower = backendMessage.toLowerCase();
  return (
    lower.includes('registration is restricted to allowed email') || // en
    lower.includes('registrierung ist auf zulässige e-mail') || // de
    lower.includes('registro está restringido a los dominios de correo permitidos') || // es
    lower.includes('inscription est restreinte aux domaines e-mail autorisés') || // fr
    lower.includes('registrazione è limitata ai domini email consentiti') // it
  );
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('auth');
  const { setUser, isAuthenticated } = useAuthStore();
  const { setCurrentTeam, setUserRoleInCurrentTeam, setUserTeamsWithRoles } = useTeamStore();
  const { initializeSession } = useSessionStore();
  const { handleError } = useApiError();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'error' | 'warning' | 'info'>('error');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [registrationPolicy, setRegistrationPolicy] = useState<RegistrationPolicy>({
    restricted: false,
    allowedDomains: [],
  });
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);

  const passwordStrength = useMemo(
    () => (isRegisterMode ? getPasswordStrength(password) : null),
    [isRegisterMode, password]
  );

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const currentPath = getCurrentPath();
      if (currentPath === '/login' || currentPath === '/register') {
        void navigate('/dashboard');
      }
    }
  }, [isAuthenticated, navigate]);

  /**
   * Whether the demo persona panel is available.
   *
   * Tested inline rather than through `mocks/config.ts` so the bundler folds it to
   * a literal and drops the panel, and the persona catalogue with it, from a
   * production build. See the same note in `src/main.tsx`.
   */
  const demoPanelAvailable = import.meta.env.VITE_USE_MOCK_API === 'true';

  const [pendingPersona, setPendingPersona] = useState<string | null>(null);

  /** Everything that has to happen once the API says who the visitor is. */
  const applyAuthenticatedSession = useCallback(
    (user: User, sessionInfo: AuthenticatedSessionInfo) => {
      setUser(user);
      if (user.locale) {
        syncLocaleFromUser(user.locale);
      }
      initializeSession({
        expiresAt: new Date(sessionInfo.expiresAt),
        idleTimeoutMs: sessionInfo.idleTimeoutMs,
        absoluteTimeoutMs: sessionInfo.absoluteTimeoutMs,
        warningThresholdMs: sessionInfo.warningThresholdMs,
      });
    },
    [setUser, initializeSession]
  );

  /** Loads the visitor's teams and selects the first one, then moves on. */
  const selectTeamsAfterSignIn = useCallback(
    async (emptyPath: string) => {
      try {
        const teamsResponse = await apiService.getMyTeams();
        if (teamsResponse.success && teamsResponse.data && teamsResponse.data.length > 0) {
          setUserTeamsWithRoles(teamsResponse.data);

          const firstTeam = teamsResponse.data[0];
          if (firstTeam?.id) {
            const { userRole, ...teamData } = firstTeam;
            setCurrentTeam(teamData);
            setUserRoleInCurrentTeam(userRole);
          }
          void navigate('/dashboard');
        } else {
          void navigate(emptyPath);
        }
      } catch (error) {
        logger.warn('Failed to fetch teams', undefined, { error });
        void navigate(emptyPath);
      }
    },
    [navigate, setCurrentTeam, setUserRoleInCurrentTeam, setUserTeamsWithRoles]
  );

  /**
   * Signs in as a demo persona.
   *
   * Runs the ordinary sign-in and then selects the team the card stands for,
   * before the teams are read, so the role the interface resolves is the one
   * printed on the card. That is what makes the same person resolve as the
   * Product Owner on one card and the Scrum Master on another.
   */
  const handlePersonaSignIn = useCallback(
    async (card: PersonaCard, password: string) => {
      setPendingPersona(card.key);
      setError(null);
      setErrorType('error');

      try {
        const response = await apiService.login({ email: card.email, password });

        if (!response.success || !response.data) {
          const userFriendlyMessage = getUserFriendlyErrorMessage(response.error?.message, 'login');
          setError(userFriendlyMessage);
          return;
        }

        await apiService.selectTeam(card.teamId);
        applyAuthenticatedSession(response.data.user, response.data.sessionInfo);
        await selectTeamsAfterSignIn('/team');
      } catch (err) {
        setError(handleError(err, t('login.loginFailed') as string));
        setErrorType('error');
      } finally {
        setPendingPersona(null);
      }
    },
    [applyAuthenticatedSession, selectTeamsAfterSignIn, handleError, t]
  );

  // Fetch the registration policy when entering register mode so the form can
  // reflect the domain restriction (cosmetic guidance only; never the boundary).
  useEffect(() => {
    if (!isRegisterMode) return;
    let cancelled = false;
    void apiService
      .getRegistrationPolicy()
      .then((response) => {
        if (!cancelled && response.success && response.data) {
          setRegistrationPolicy(response.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          logger.warn('Failed to fetch registration policy', undefined, { error: err });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isRegisterMode]);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);
      setErrorType('error');

      try {
        const credentials: LoginCredentials = { email, password };
        const response = await apiService.login(credentials);

        if (response.success && response.data) {
          applyAuthenticatedSession(response.data.user, response.data.sessionInfo);
          await selectTeamsAfterSignIn('/team');
        } else {
          const backendMessage = response.error?.message;
          const userFriendlyMessage = getUserFriendlyErrorMessage(backendMessage, 'login');
          setError(userFriendlyMessage);
          setErrorType('error');
        }
      } catch (err) {
        const axiosError = err as {
          response?: {
            data?: {
              error?: { message?: string; details?: ErrorDetails['details'] };
            };
            status?: number;
          };
          message?: string;
        };

        if (import.meta.env.DEV) {
          logger.debug('Login error', undefined, {
            error: err,
            response: axiosError.response,
            data: axiosError.response?.data,
          });
        }

        let backendMessage = axiosError.response?.data?.error?.message;
        const errorDetails = axiosError.response?.data?.error;

        if (!backendMessage && err instanceof Error) {
          backendMessage = err.message;
        }

        if (backendMessage || errorDetails?.details) {
          const userFriendlyMessage = getUserFriendlyErrorMessage(
            backendMessage,
            'login',
            errorDetails
          );
          setError(userFriendlyMessage);
        } else {
          const errorMessage = handleError(err, t('login.loginFailed') as string);
          setError(errorMessage);
        }
        setErrorType('error');
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, applyAuthenticatedSession, selectTeamsAfterSignIn, handleError, t]
  );

  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);
      setErrorType('error');

      try {
        const response = await apiService.register({
          email,
          password,
          firstName,
          lastName,
          termsAccepted: true as const,
          locale: useI18nStore.getState().locale,
        });

        if (response.success && response.data) {
          const { user, sessionInfo } = response.data;

          applyAuthenticatedSession(user, sessionInfo);

          setCurrentTeam(null);

          void navigate('/team');
        } else {
          const backendMessage = response.error?.message;
          if (isDomainNotAllowedError(backendMessage)) {
            setEmailFieldError(
              t('login.emailDomainNotAllowed', {
                domain: registrationPolicy.allowedDomains.join(', '),
              }) as string
            );
            setError(null);
          } else {
            const userFriendlyMessage = getUserFriendlyErrorMessage(backendMessage, 'register');
            setError(userFriendlyMessage);
            setErrorType('error');
          }
        }
      } catch (err) {
        const axiosError = err as {
          response?: {
            data?: {
              error?: { message?: string; details?: ErrorDetails['details'] };
            };
            status?: number;
          };
          message?: string;
        };

        if (import.meta.env.DEV) {
          logger.debug('Register error', undefined, {
            error: err,
            response: axiosError.response,
            data: axiosError.response?.data,
          });
        }

        let backendMessage = axiosError.response?.data?.error?.message;
        const errorDetails = axiosError.response?.data?.error;

        if (!backendMessage && err instanceof Error) {
          backendMessage = err.message;
        }

        if (isDomainNotAllowedError(backendMessage)) {
          setEmailFieldError(
            t('login.emailDomainNotAllowed', {
              domain: registrationPolicy.allowedDomains.join(', '),
            }) as string
          );
          setError(null);
        } else if (backendMessage || errorDetails?.details) {
          const userFriendlyMessage = getUserFriendlyErrorMessage(
            backendMessage,
            'register',
            errorDetails
          );
          setError(userFriendlyMessage);
        } else {
          const errorMessage = handleError(err, t('login.registerFailed') as string);
          setError(errorMessage);
        }
        setErrorType('error');
      } finally {
        setIsLoading(false);
      }
    },
    [
      email,
      password,
      firstName,
      lastName,
      navigate,
      applyAuthenticatedSession,
      setCurrentTeam,
      handleError,
      t,
      registrationPolicy,
    ]
  );

  const clearError = () => {
    setError(null);
    setEmailFieldError(null);
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError(null);
    setEmailFieldError(null);
    setTermsAccepted(false);
    setShowPassword(false);
  };

  const isSubmitDisabled = isLoading || (isRegisterMode && !termsAccepted);

  return (
    <div className={styles['auth-page']}>
      <div className={styles['auth-card']}>
        {/* Header */}
        <div className={styles['auth-header']}>
          <div className={styles['auth-logo']} aria-hidden="true">
            <ScrumoothIcon size={100} className={styles['auth-logo-icon']} />
          </div>
          <h1 className={styles['auth-title']}>
            {isRegisterMode ? t('login.createYourAccount') : t('welcomeBack')}
          </h1>
          <p className={styles['auth-subtitle']}>
            {isRegisterMode ? t('login.startManaging') : t('login.signInTo', { app: 'Scrumooth' })}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className={styles['error-message']}>
            <ErrorMessage
              message={error}
              title={isRegisterMode ? t('login.registrationError') : t('login.loginError')}
              type={errorType}
              onDismiss={clearError}
            />
          </div>
        )}

        {/* Form */}
        <form
          className={styles['auth-form']}
          onSubmit={
            isRegisterMode
              ? (e) => {
                  void handleRegister(e);
                }
              : (e) => {
                  void handleLogin(e);
                }
          }
        >
          {/* Name Fields (Register only) */}
          {isRegisterMode && (
            <div className={styles['form-row']}>
              <div className={styles['form-group']}>
                <label className={styles['form-label']} htmlFor="firstName">
                  {t('firstName')}
                  <span className={styles['form-label-required']} aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  className={styles['input-field']}
                  placeholder={t('login.placeholder.firstName')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className={styles['form-group']}>
                <label className={styles['form-label']} htmlFor="lastName">
                  {t('lastName')}
                  <span className={styles['form-label-required']} aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  className={styles['input-field']}
                  placeholder={t('login.placeholder.lastName')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className={styles['form-group']}>
            <label className={styles['form-label']} htmlFor="email">
              {t('email')}
              <span className={styles['form-label-required']} aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="email"
              type="email"
              className={`${styles['input-field']} ${
                emailFieldError ? styles['input-field-error'] : ''
              }`}
              placeholder={t('placeholder.email')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailFieldError) setEmailFieldError(null);
              }}
              required
              autoComplete="email"
              aria-invalid={emailFieldError ? true : undefined}
              aria-describedby={
                emailFieldError
                  ? 'email-field-error'
                  : isRegisterMode && registrationPolicy.restricted
                    ? 'email-field-hint'
                    : undefined
              }
            />
            {/* Registration domain restriction hint (register mode, cosmetic only) */}
            {isRegisterMode && registrationPolicy.restricted && !emailFieldError && (
              <div className={styles['domain-hint']} role="note">
                <InfoIcon size={16} className={styles['domain-hint-icon']} aria-hidden="true" />
                <p className={styles['domain-hint-text']} id="email-field-hint">
                  {t('login.emailDomainHint', {
                    domains: registrationPolicy.allowedDomains.join(', '),
                  })}
                </p>
              </div>
            )}
            {/* Inline email field error (register domain rejection) */}
            {emailFieldError && (
              <p className={styles['field-error']} id="email-field-error" role="alert">
                {emailFieldError}
              </p>
            )}
          </div>

          {/* Password */}
          <div className={styles['form-group']}>
            <label className={styles['form-label']} htmlFor="password">
              {t('password')}
              <span className={styles['form-label-required']} aria-hidden="true">
                *
              </span>
            </label>
            <div className={styles['input-wrapper']}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`${styles['input-field']} ${styles['input-field-has-trailing']}`}
                placeholder={
                  isRegisterMode ? t('login.placeholder.createPassword') : t('placeholder.password')
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className={styles['password-toggle']}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                tabIndex={0}
              >
                {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>

            {/* Password Strength (Register only) */}
            {isRegisterMode && password && (
              <div className={styles['password-strength']} aria-live="polite">
                <div className={styles['strength-bars']}>
                  {[0, 1, 2, 3].map((index) => {
                    const strengthClass =
                      passwordStrength === 'weak'
                        ? index === 0
                          ? styles['strength-bar-weak']
                          : ''
                        : passwordStrength === 'fair'
                          ? index <= 1
                            ? styles['strength-bar-fair']
                            : ''
                          : passwordStrength === 'good'
                            ? index <= 2
                              ? styles['strength-bar-good']
                              : ''
                            : styles['strength-bar-strong'];

                    return (
                      <div key={index} className={`${styles['strength-bar']} ${strengthClass}`} />
                    );
                  })}
                </div>
                <span
                  className={`${styles['strength-label']} ${
                    passwordStrength === 'weak'
                      ? styles['strength-label-weak']
                      : passwordStrength === 'fair'
                        ? styles['strength-label-fair']
                        : passwordStrength === 'good'
                          ? styles['strength-label-good']
                          : styles['strength-label-strong']
                  }`}
                >
                  {t(`login.passwordStrength.${passwordStrength ?? 'weak'}` as never)}
                </span>
              </div>
            )}
          </div>

          {/* Forgot Password Link (Login only) */}
          {!isRegisterMode && (
            <div className={styles['forgot-password-link']}>
              <Link to="/forgot-password">{t('login.forgotPassword')}</Link>
            </div>
          )}

          {/* Consent (Register only) */}
          {isRegisterMode && (
            <div className={styles['consent-group']}>
              <label className={styles['consent-label']}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  required
                  className={styles['consent-checkbox']}
                />
                <span className={styles['consent-text']}>{t('login.consentText')}</span>
              </label>
            </div>
          )}

          {/* Submit */}
          <button type="submit" className={styles['submit-button']} disabled={isSubmitDisabled}>
            {isLoading ? (
              <span className={styles['button-loading']}>
                <LoaderIcon size={16} className={styles['spinner-icon']} />
                {isRegisterMode ? t('login.creatingAccount') : t('login.signingIn')}
              </span>
            ) : isRegisterMode ? (
              t('login.createAccount')
            ) : (
              t('signIn')
            )}
          </button>
        </form>

        {/* Footer */}
        <div className={styles['auth-footer']}>
          <button
            type="button"
            className={styles['mode-toggle']}
            onClick={toggleMode}
            data-testid="mode-toggle"
          >
            {isRegisterMode ? t('login.alreadyHaveAccount') : t('login.noAccountYet')}
          </button>
        </div>

        {/* One-click demo personas. Rendered only in mock mode, so a real
            deployment never shows a card and never ships the catalogue. */}
        {demoPanelAvailable && !isRegisterMode && (
          <PersonaQuickSignIn
            onSignIn={handlePersonaSignIn}
            pendingKey={pendingPersona}
            disabled={isLoading}
          />
        )}
      </div>
    </div>
  );
};
