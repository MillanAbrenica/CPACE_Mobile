import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { Loader } from '@/components/cpace-ui';
import { CPACE, Font } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Shared maroon native header for pushed sub-pages (More menu items).
const maroonHeader = {
  headerShown: true,
  headerStyle: { backgroundColor: CPACE.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontFamily: Font.semibold },
  headerShadowVisible: false,
} as const;

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';
    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, router]);

  if (loading) return <Loader />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="review-notes" options={{ ...maroonHeader, title: 'Review Notes' }} />
      <Stack.Screen name="quiz-history" options={{ ...maroonHeader, title: 'Quiz History' }} />
      <Stack.Screen name="performance" options={{ ...maroonHeader, title: 'Performance' }} />
      <Stack.Screen name="calendar" options={{ ...maroonHeader, title: 'Review Calendar' }} />
      <Stack.Screen name="achievements" options={{ ...maroonHeader, title: 'Achievements' }} />
      <Stack.Screen name="settings" options={{ ...maroonHeader, title: 'Settings' }} />
      <Stack.Screen name="quiz" options={{ ...maroonHeader, title: 'Quiz' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
