//
//  SettingsView.swift
//  FloorPlanScanner
//
//  App settings and preferences
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settingsManager: SettingsManager
    @Environment(\.presentationMode) var presentationMode

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Measurements")) {
                    Picker("Unit System", selection: $settingsManager.measurementUnit) {
                        ForEach(SettingsManager.MeasurementUnit.allCases, id: \.self) { unit in
                            Text(unit.rawValue).tag(unit)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())

                    HStack {
                        Text("Length Unit")
                        Spacer()
                        Text(settingsManager.measurementUnit.lengthUnit)
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Area Unit")
                        Spacer()
                        Text(settingsManager.measurementUnit.areaUnit)
                            .foregroundColor(.secondary)
                    }
                }

                Section(header: Text("Scanning")) {
                    Toggle("Show Mesh During Scanning", isOn: $settingsManager.showMeshDuringScanning)

                    Toggle("Auto-Generate Floor Plan", isOn: $settingsManager.autoGenerateFloorPlan)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Scanning Tips")
                            .font(.subheadline)
                            .fontWeight(.semibold)

                        Text("• Move slowly and steadily")
                        Text("• Point camera at walls and corners")
                        Text("• Ensure good lighting")
                        Text("• Cover all areas of the room")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 4)
                }

                Section(header: Text("About")) {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("LiDAR Available")
                        Spacer()
                        Text(ARManager.shared.isLiDARAvailable() ? "Yes" : "No")
                            .foregroundColor(ARManager.shared.isLiDARAvailable() ? .green : .red)
                    }

                    Button(action: {
                        settingsManager.hasCompletedOnboarding = false
                    }) {
                        Text("Show Tutorial Again")
                    }
                }

                Section {
                    Button(action: {
                        settingsManager.resetToDefaults()
                    }) {
                        Text("Reset to Defaults")
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
        }
    }
}

struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsView()
            .environmentObject(SettingsManager.shared)
    }
}
