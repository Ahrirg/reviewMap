import { useState } from 'react';

import { Button, ErrorBanner, Spinner } from './Modal.jsx';
import { useSession } from '../hooks/useSession.jsx';

/**
 * Wording for a failed login.
 *
 * Mapped from the status rather than shown from err.message, because the
 * server answers in English and this is the first screen anyone sees. The
 * generic 401 text in api/client.js is about an expired session, which is the
 * wrong thing to say to someone who has just mistyped a password.
 */
function loginError(err) {
  if (err?.status === 401) return 'Neteisingas slaptažodis.';
  if (err?.status === 429) return 'Per daug bandymų. Pabandykite po kelių minučių.';
  return err?.message ?? 'Nepavyko prisijungti.';
}

/**
 * The gate in front of the map.
 *
 * Deliberately not a Modal: this one cannot be dismissed with Escape or a
 * click on the backdrop, and there is nothing behind it to portal over.
 */
export function LoginScreen() {
  const { login, continueAsGuest } = useSession();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;

    // Nothing typed means "I only wanted to look" -- the same as the guest
    // button, which is what "specify a password if you want" should feel like.
    if (password === '') {
      continueAsGuest();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await login(password);
    } catch (err) {
      setError(loginError(err));
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900">
              Sandros vemimo žemėlapis
            </h1>
            <p className="text-sm text-slate-500">Prisijungimas</p>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="mt-5">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />

          <fieldset disabled={busy} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Slaptažodis</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
                autoComplete="current-password"
                placeholder="Palikite tuščią, jei norite tik peržiūrėti"
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
                  error
                    ? 'border-red-400 focus:ring-red-300'
                    : 'border-slate-300 focus:border-slate-400 focus:ring-slate-200'
                }`}
              />
            </label>

            <div className="flex flex-col gap-2">
              <Button variant="primary" type="submit" className="w-full">
                {busy && <Spinner className="h-3.5 w-3.5" />}
                Prisijungti
              </Button>
              <Button type="button" onClick={continueAsGuest} className="w-full">
                Tęsti kaip svečias
              </Button>
            </div>
          </fieldset>
        </form>

        <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
          Svečiai gali tik peržiūrėti žemėlapį. Norėdami pridėti žymeklių ar atsiliepimų,
          prisijunkite slaptažodžiu.
        </p>
      </div>
    </div>
  );
}
