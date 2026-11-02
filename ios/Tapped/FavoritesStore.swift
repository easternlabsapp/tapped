import Foundation
import Observation

/// A saved location. Only the ZIP code and its display name are stored.
struct Favorite: Codable, Identifiable, Equatable {
    let zip: String
    var name: String
    var id: String { zip }
}

/// Saved locations, kept on the device only (UserDefaults). Nothing here is sent anywhere.
@MainActor
@Observable
final class FavoritesStore {
    private(set) var items: [Favorite]

    private let defaults: UserDefaults
    private let key = "favorites.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: key), let saved = try? JSONDecoder().decode([Favorite].self, from: data) {
            items = saved
        } else {
            items = []
        }
    }

    func contains(zip: String) -> Bool { items.contains { $0.zip == zip } }

    /// Adds the location, or removes it if already saved.
    func toggle(zip: String, name: String?) {
        if let index = items.firstIndex(where: { $0.zip == zip }) {
            items.remove(at: index)
        } else {
            items.insert(Favorite(zip: zip, name: name ?? "ZIP \(zip)"), at: 0)
        }
        save()
    }

    func remove(at offsets: IndexSet) {
        items.remove(atOffsets: offsets)
        save()
    }

    private func save() {
        if let data = try? JSONEncoder().encode(items) { defaults.set(data, forKey: key) }
    }
}
