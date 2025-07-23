"use client"

import { useEffect, useRef } from "react"
import { View, Text, StyleSheet, Animated } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

export const SplashScreen = () => {
    const fadeAnim = useRef(new Animated.Value(0)).current
    const scaleAnim = useRef(new Animated.Value(0.9)).current
    const translateYAnim = useRef(new Animated.Value(20)).current

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(translateYAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            }),
        ]).start()
    }, [])

    return (
        <LinearGradient colors={["#6a11cb", "#2575fc"]} style={styles.container}>
            <Animated.View
                style={[
                    styles.logoContainer,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
                    },
                ]}
            >
                <View style={styles.logoCircle}>
                    <Text style={styles.logoText}>DR</Text>
                </View>
                <Text style={styles.appName}>Dyslexia Reader</Text>
                <Text style={styles.tagline}>Making reading accessible for everyone</Text>
            </Animated.View>
        </LinearGradient>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
    },
    logoContainer: {
        alignItems: "center",
        justifyContent: "center",
    },
    logoCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: "white",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
        marginBottom: 20,
    },
    logoText: {
        fontSize: 60,
        fontWeight: "bold",
        color: "#6a11cb",
        fontFamily: "OpenDyslexic",
    },
    appName: {
        fontSize: 32,
        fontWeight: "bold",
        color: "white",
        marginTop: 20,
        fontFamily: "OpenDyslexic",
        textAlign: "center",
    },
    tagline: {
        fontSize: 16,
        color: "rgba(255, 255, 255, 0.8)",
        marginTop: 10,
        fontFamily: "OpenDyslexic",
        textAlign: "center",
    },
})
