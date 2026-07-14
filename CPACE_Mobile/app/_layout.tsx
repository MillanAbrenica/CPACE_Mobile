import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

  if (loading) return <Loader />;

  // Protected groups: while logged out only login/signup can mount, so no
  // screen fires an API request before a token exists. After login the guard
  // flips, (tabs) mounts fresh and loads data with the token in place.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="review-notes" options={{ ...maroonHeader, title: 'Review Notes' }} />
        <Stack.Screen name="quiz-history" options={{ ...maroonHeader, title: 'Quiz History' }} />
        <Stack.Screen name="performance" options={{ ...maroonHeader, title: 'Performance' }} />
        <Stack.Screen name="calendar" options={{ ...maroonHeader, title: 'Review Calendar' }} />
        <Stack.Screen name="achievements" options={{ ...maroonHeader, title: 'Achievements' }} />
        <Stack.Screen name="settings" options={{ ...maroonHeader, title: 'Settings' }} />
        <Stack.Screen name="quiz" options={{ ...maroonHeader, title: 'Quiz' }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>
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
