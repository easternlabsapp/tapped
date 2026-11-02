import SwiftUI

/// Saved locations. Tapping one looks it up again.
struct FavoritesView: View {
    let store: FavoritesStore
    let onSelect: (Favorite) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                WaterBackground()
                if store.items.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "star").font(.system(size: 40, weight: .light)).foregroundStyle(Theme.secondaryText)
                        Text("No saved locations yet")
                            .font(Theme.rounded(.title3, weight: .semibold)).foregroundStyle(.white)
                        Text("After a lookup, tap the star next to the place name to save it here.")
                            .font(Theme.rounded(.body)).foregroundStyle(Theme.secondaryText)
                            .multilineTextAlignment(.center)
                    }
                    .padding(32)
                } else {
                    List {
                        ForEach(store.items) { favorite in
                            Button {
                                onSelect(favorite)
                                dismiss()
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(favorite.name).font(Theme.rounded(.headline, weight: .semibold)).foregroundStyle(.white)
                                    Text("ZIP \(favorite.zip)").font(Theme.rounded(.subheadline)).foregroundStyle(Theme.secondaryText)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 4)
                            }
                            .listRowBackground(Color.white.opacity(0.1))
                            .accessibilityHint("Looks up this location again")
                        }
                        .onDelete { store.remove(at: $0) }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Saved locations")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if !store.items.isEmpty { EditButton() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
        .tint(Theme.aqua)
    }
}
