import * as React from 'react';
import { LoginForm } from '../../components/LoginForm';
import { currentLang } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

// Page serveur : la langue est résolue ici pour que le formulaire sorte déjà
// traduit et dans la bonne direction (cf. `dir` posé sur <html>).
export default function LoginPage() {
  return <LoginForm lang={currentLang()} />;
}
