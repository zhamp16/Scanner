//
//  SavedScansView.swift
//  FloorPlanScanner
//
//  List of saved scans
//

import SwiftUI

struct SavedScansView: View {
    @EnvironmentObject var dataManager: DataManager
    @State private var selectedScan: ScanData?
    @State private var showFloorPlan = false

    var body: some View {
        ZStack {
            if dataManager.scans.isEmpty {
                VStack(spacing: 20) {
                    Image(systemName: "folder")
                        .font(.system(size: 60))
                        .foregroundColor(.gray)

                    Text("No Saved Scans")
                        .font(.title2)
                        .fontWeight(.semibold)

                    Text("Your scanned floor plans will appear here")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }
            } else {
                List {
                    ForEach(dataManager.scans) { scan in
                        ScanRowView(scan: scan)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectedScan = scan
                                showFloorPlan = true
                            }
                    }
                    .onDelete(perform: deleteScans)
                }
                .listStyle(InsetGroupedListStyle())
            }
        }
        .navigationTitle("Saved Scans")
        .navigationBarTitleDisplayMode(.large)
        .fullScreenCover(isPresented: $showFloorPlan) {
            if let scan = selectedScan {
                FloorPlanDetailView(scan: scan)
            }
        }
    }

    private func deleteScans(at offsets: IndexSet) {
        for index in offsets {
            let scan = dataManager.scans[index]
            dataManager.deleteScan(scan)
        }
    }
}

struct ScanRowView: View {
    let scan: ScanData
    @EnvironmentObject var settingsManager: SettingsManager

    var body: some View {
        HStack(spacing: 16) {
            // Thumbnail or icon
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.blue.opacity(0.2))
                    .frame(width: 60, height: 60)

                Image(systemName: "map")
                    .font(.title2)
                    .foregroundColor(.blue)
            }

            // Scan info
            VStack(alignment: .leading, spacing: 4) {
                Text(scan.name)
                    .font(.headline)

                Text(DateFormatter.shortDate.string(from: scan.timestamp))
                    .font(.caption)
                    .foregroundColor(.secondary)

                if let floorPlan = scan.floorPlan {
                    HStack(spacing: 12) {
                        Label("\(floorPlan.walls.count) walls", systemImage: "square.split.2x2")
                            .font(.caption2)
                            .foregroundColor(.secondary)

                        Label(settingsManager.formatArea(floorPlan.dimensions.totalArea), systemImage: "ruler")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.gray)
        }
        .padding(.vertical, 8)
    }
}

struct SavedScansView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            SavedScansView()
                .environmentObject(DataManager.shared)
                .environmentObject(SettingsManager.shared)
        }
    }
}
