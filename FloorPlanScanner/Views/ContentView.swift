//
//  ContentView.swift
//  FloorPlanScanner
//
//  Main navigation and home screen
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var dataManager: DataManager
    @EnvironmentObject var settingsManager: SettingsManager
    @State private var showOnboarding = false
    @State private var showSettings = false
    @State private var navigateToScanner = false

    var body: some View {
        NavigationView {
            ZStack {
                Color.black.ignoresSafeArea()

                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 12) {
                        Image(systemName: "scanner.fill")
                            .font(.system(size: 80))
                            .foregroundColor(.blue)

                        Text("Floor Plan Scanner")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundColor(.white)

                        Text("LiDAR-powered floor plan generation")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                    .padding(.top, 60)

                    Spacer()

                    // Check LiDAR availability
                    if !ARManager.shared.isLiDARAvailable() {
                        VStack(spacing: 12) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 50))
                                .foregroundColor(.orange)

                            Text("LiDAR Not Available")
                                .font(.headline)
                                .foregroundColor(.white)

                            Text("This app requires a device with a LiDAR sensor (iPhone 12 Pro or later, iPad Pro 2020 or later)")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 32)
                        }
                        .padding()
                    }

                    // Main actions
                    VStack(spacing: 16) {
                        // New Scan button
                        NavigationLink(destination: ScannerView(), isActive: $navigateToScanner) {
                            EmptyView()
                        }

                        Button(action: {
                            navigateToScanner = true
                        }) {
                            HStack {
                                Image(systemName: "plus.circle.fill")
                                    .font(.title2)
                                Text("New Scan")
                                    .font(.headline)
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(ARManager.shared.isLiDARAvailable() ? Color.blue : Color.gray)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(!ARManager.shared.isLiDARAvailable())

                        // Saved Scans button
                        NavigationLink(destination: SavedScansView()) {
                            HStack {
                                Image(systemName: "folder.fill")
                                    .font(.title2)
                                Text("Saved Scans (\(dataManager.scans.count))")
                                    .font(.headline)
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.gray.opacity(0.3))
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                    }
                    .padding(.horizontal, 32)

                    Spacer()

                    // Footer buttons
                    HStack(spacing: 24) {
                        Button(action: {
                            showOnboarding = true
                        }) {
                            VStack {
                                Image(systemName: "questionmark.circle")
                                    .font(.title2)
                                Text("Tutorial")
                                    .font(.caption)
                            }
                            .foregroundColor(.gray)
                        }

                        Spacer()

                        Button(action: {
                            showSettings = true
                        }) {
                            VStack {
                                Image(systemName: "gear")
                                    .font(.title2)
                                Text("Settings")
                                    .font(.caption)
                            }
                            .foregroundColor(.gray)
                        }
                    }
                    .padding(.horizontal, 48)
                    .padding(.bottom, 32)
                }
            }
            .sheet(isPresented: $showOnboarding) {
                OnboardingView()
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .navigationBarHidden(true)
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .onAppear {
            // Show onboarding on first launch
            if !settingsManager.hasCompletedOnboarding {
                showOnboarding = true
            }
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(DataManager.shared)
            .environmentObject(SettingsManager.shared)
    }
}
