import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthStackParamList } from "./types";
import WelcomeScreen from "@/screens/auth/WelcomeScreen";
import SignInScreen from "@/screens/auth/SignInScreen";
import SignUpScreen from "@/screens/auth/SignUpScreen";
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";
import ResetPasswordScreen from "@/screens/auth/ResetPasswordScreen";
import EmailVerificationScreen from "@/screens/auth/EmailVerificationScreen";
import { useTheme } from "@/hooks/useTheme";
import { getAuthStackOptions, getAuthScreenOptions } from "./screenOptions";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getAuthStackOptions({ theme, isDark })}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen
        name="SignIn"
        component={SignInScreen}
        options={({ navigation }) => getAuthScreenOptions({ theme, isDark, navigation })}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={({ navigation }) => getAuthScreenOptions({ theme, isDark, navigation })}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={({ navigation }) => getAuthScreenOptions({ theme, isDark, navigation })}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={({ navigation }) => getAuthScreenOptions({ theme, isDark, navigation })}
      />
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        options={({ navigation }) => getAuthScreenOptions({ theme, isDark, navigation })}
      />
    </Stack.Navigator>
  );
}
