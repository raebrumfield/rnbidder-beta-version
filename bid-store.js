/* ═══════════════════════════════════════════
   RnB Bidding Tool — Bid Storage (localStorage)
   ═══════════════════════════════════════════
   Simple client-side persistence for bid data.
   All bids are stored as a JSON array under the key "rnb_bids".
*/

const BidStore = (() => {
  const STORAGE_KEY = "rnb_bids";

  /**
   * Retrieve all bids from localStorage.
   * @returns {Array} Array of bid objects.
   */
  function list() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("BidStore.list error:", e);
      return [];
    }
  }

  /**
   * Persist the full bids array to localStorage.
   */
  function _persist(bids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bids));
  }

  /**
   * Get a single bid by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  function get(id) {
    return list().find(b => b.id === id) || null;
  }

  /**
   * Save (upsert) a bid object.
   * If a bid with the same ID exists, it is replaced; otherwise it is appended.
   * @param {Object} bid — must include an `id` field.
   * @returns {Object} The saved bid.
   */
  function save(bid) {
    if (!bid.id) bid.id = generateId();
    bid.updatedAt = new Date().toISOString();
    if (!bid.createdAt) bid.createdAt = bid.updatedAt;

    const bids = list();
    const idx = bids.findIndex(b => b.id === bid.id);
    if (idx >= 0) {
      bids[idx] = bid;
    } else {
      bids.push(bid);
    }
    _persist(bids);
    return bid;
  }

  /**
   * Remove a bid by ID.
   * @param {string} id
   */
  function remove(id) {
    const bids = list().filter(b => b.id !== id);
    _persist(bids);
  }

  /**
   * Generate a simple unique ID.
   * @returns {string}
   */
  function generateId() {
    return "bid-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  // Public API
  return { list, get, save, remove, generateId };
})();
