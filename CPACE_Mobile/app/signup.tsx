import { Field, PrimaryButton } from '@/components/auth-ui';
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

export default function SignupScreen() {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing details', 'Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password);
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message ?? 'Something went wrong. Please try again.');
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
                <FontAwesome6 name="graduation-cap" size={26} color="#fff" />
              </View>
              <T weight="bold" size={22} color="#fff" style={{ letterSpacing: 1 }}>
                CPACE
              </T>
            </View>

            <View style={styles.card}>
              <T weight="bold" size={20}>
                Create your account
              </T>
              <T size={13} color={CPACE.gray500} style={{ marginTop: 2, marginBottom: 18 }}>
                Start your CPA board review today
              </T>

              <View style={{ gap: 12 }}>
                <Field icon="user" placeholder="Full name" value={name} onChangeText={setName} />
                <Field
                  icon="envelope"
                  placeholder="Email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
                <Field icon="lock" placeholder="Password" secure value={password} onChangeText={setPassword} />
                <Field icon="lock" placeholder="Confirm password" secure value={confirm} onChangeText={setConfirm} />
              </View>

              <View style={{ height: 18 }} />
              <PrimaryButton label="Sign up" onPress={onSignup} loading={loading} />

              <View style={styles.footer}>
                <T size={13} color={CPACE.gray700}>
                  Already have an account?{' '}
                </T>
                <Link href="/login" asChild>
                  <Pressable>
                    <T size={13} weight="semibold" color={CPACE.primary}>
                      Log in
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
  brand: { alignItems: 'center', marginBottom: 22 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  card: { backgroundColor: '#fff', borderRadius: Radius.xl, padding: 24 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
});
