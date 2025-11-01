//
//  FloorPlanScannerApp.swift
//  FloorPlanScanner
//
//  Main entry point for the LiDAR Floor Plan Scanner app
//

import SwiftUI

@main
struct FloorPlanScannerApp: App {
    @StateObject private var dataManager = DataManager.shared
    @StateObject private var settingsManager = SettingsManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(dataManager)
                .environmentObject(settingsManager)
                .preferredColorScheme(.dark) // AR apps work better with dark mode
        }
    }
}
