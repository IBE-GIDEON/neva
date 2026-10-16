import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, haptic, Header, Icon, T } from '@/components/ui';
import { BACKEND_READY } from '@/config';
import { isValidEmail, logInWithEmail, passwordProblem, sendPasswordReset, signUpWithEmail } from '@/lib/auth';
import { showToast } from '@/store';
import { radius, useTheme } from '@/theme';

/** Email + password sign up / log in (free — no per-login SMS cost). */
export default function EmailAuth() {
  const params = useLocalSearchParams<{ mode?: 'signup' | 'login' }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'signup' | 'login'>(params.mode === 'login' ? 'login' : 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const signup = mode === 'signup';
  const emailOk = isValidEmail(email);
  const pwIssue = signup ? passwordProblem(password) : password.length ? null : 'Enter your password';
  const valid = emailOk && !pwIssue;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    setInfo('');
    const res = signup ? await signUpWithEmail(email, password) : await logInWithEmail(email, password);
    setBusy(false);
    if (!res.ok) {
      haptic.warn();
      setError(res.error ?? 'Something went wrong. Try again.');
      return;
    }
    if ('needsConfirm' in res && res.needsConfirm) {
      setInfo(`We sent a confirmation link to ${email.trim()}. Open it, then log in.`);
      setMode('login');
      return;
    }
    haptic.success();
    router.replace('/');
  };

  const forgot = async () => {
    if (!emailOk) return setError('Enter your email first, then tap “Forgot password”.');
    const res = await sendPasswordReset(email);
    if (res.ok) showToast('Password reset email sent', 'mail-outline');
    else setError(res.error ?? 'Couldn’t send reset email.');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <T size={26} weight="700">{signup ? 'Create your account' : 'Welcome back'}</T>
        <T dim style={{ lineHeight: 21 }}>{signup ? 'Use your email. It stays private.' : 'Log in with your email and password.'}</T>

        <View style={{ gap: 12, marginTop: 22 }}>
          <Input icon="mail-outline" value={email} onChange={(v) => { setEmail(v); setError(''); }} placeholder="Email" keyboardType="email-address" autoComplete="email" />
          <Input
            icon="lock-closed-outline"
            value={password}
            onChange={(v) => { setPassword(v); setError(''); }}
            placeholder="Password"
            secure={!show}
            autoComplete={signup ? 'new-password' : 'current-password'}
            right={
              <Pressable onPress={() => setShow(!show)} hitSlop={10}>
                <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={19} color={t.textDim} />
              </Pressable>
            }
            onSubmit={submit}
          />
        </View>

        {signup && password.length > 0 && pwIssue && <T faint size={12.5}>{pwIssue}</T>}
        {!!error && <T color={t.danger} size={13.5} style={{ lineHeight: 19 }}>{error}</T>}
        {!!info && <T color={t.primary} size={13.5} style={{ lineHeight: 19 }}>{info}</T>}

        {!signup && BACKEND_READY && (
          <Pressable onPress={forgot} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <T color={t.primary} size={14}>Forgot password?</T>
          </Pressable>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 14, gap: 14 }}>
        <Button title={signup ? 'Create account' : 'Log in'} variant={valid ? 'gradient' : 'secondary'} disabled={!valid} loading={busy} onPress={submit} />
        <Pressable onPress={() => { setMode(signup ? 'login' : 'signup'); setError(''); setInfo(''); }} style={{ alignSelf: 'center', padding: 4 }}>
          <T dim size={14}>
            {signup ? 'Already have an account? ' : 'New to Neva? '}
            <T color={t.text} weight="600" size={14}>{signup ? 'Log in' : 'Create account'}</T>
          </T>
        </Pressable>
        {!BACKEND_READY && <T faint size={11.5} center>Accounts are stored on this device until the server is connected.</T>}
      </View>
    </KeyboardAvoidingView>
  );
}

function Input({ icon, value, onChange, placeholder, secure, right, keyboardType, autoComplete, onSubmit }: { icon: any; value: string; onChange: (v: string) => void; placeholder: string; secure?: boolean; right?: React.ReactNode; keyboardType?: 'email-address'; autoComplete?: any; onSubmit?: () => void }) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: radius.md, borderWidth: 1.5, borderColor: focus ? t.primary : t.borderStrong, paddingHorizontal: 14 }}>
      <Icon name={icon} size={18} color={t.textDim} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={placeholder}
        placeholderTextColor={t.textFaint}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType={onSubmit ? 'go' : 'next'}
        onSubmitEditing={onSubmit}
        style={{ flex: 1, color: t.text, fontSize: 16 }}
      />
      {right}
    </View>
  );
}
