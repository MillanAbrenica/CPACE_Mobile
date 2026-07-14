import { Field, PrimaryButton, SocialButton } from '@/components/auth-ui';
import { T } from '@/components/cpace-ui';
import { CPACE, Radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setLoading(true);
    try {
      await login(email.trim(), password);
      // root layout redirects to (tabs) once user is set
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? 'Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={CPACE.headerGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <View style={styles.logo}>
                <FontAwesome6 name="graduation-cap" size={30} color="#fff" />
              </View>
              <T weight="bold" size={26} color="#fff" style={{ letterSpacing: 1 }}>
                CPACE
              </T>
              <T size={13} color="rgba(255,255,255,0.8)">
                CPA Reviewer
              </T>
            </View>

            <View style={styles.card}>
              <T weight="bold" size={20}>
                Welcome back
              </T>
              <T size={13} color={CPACE.gray500} style={{ marginTop: 2, marginBottom: 18 }}>
                Sign in to continue your review
              </T>

              <View style={{ gap: 12 }}>
                <Field
                  icon="envelope"
                  placeholder="Email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
                <Field icon="lock" placeholder="Password" secure value={password} onChangeText={setPassword} />
              </View>

              <Pressable style={{ alignSelf: 'flex-end', marginTop: 10, marginBottom: 16 }}>
                <T size={12} weight="medium" color={CPACE.primary}>
                  Forgot password?
                </T>
              </Pressable>

              <PrimaryButton label="Log in" onPress={onLogin} loading={loading} />

              <View style={styles.divider}>
                <View style={styles.line} />
                <T size={11} color={CPACE.gray500}>
                  OR CONTINUE WITH
                </T>
                <View style={styles.line} />
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <SocialButton icon="logo-google" label="Google" color="#DB4437" onPress={onLogin} />
                <SocialButton icon="logo-microsoft" label="Microsoft" color="#0078D4" onPress={onLogin} />
              </View>

              <View style={styles.footer}>
                <T size={13} color={CPACE.gray700}>
                  New here?{' '}
                </T>
                <Link href="/signup" asChild>
                  <Pressable>
                    <T size={13} weight="semibold" color={CPACE.primary}>
                      Create an account
                    </T>
                  </Pressable>
                </Link>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 26 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  card: { backgroundColor: '#fff', borderRadius: Radius.xl, padding: 24 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: CPACE.gray200 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
});
