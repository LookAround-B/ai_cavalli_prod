"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Sparkles } from "lucide-react";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { ImageSelector } from "@/components/ui/ImageSelector";
import { MenuItemSelector } from "@/components/kitchen/MenuItemSelector";
import { showError, showInfo } from "@/components/ui/Popup";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string;
  image_url: string | null;
  available: boolean;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface SpecialItem {
  id: string;
  menu_item_id: string;
  period: string;
  date: string;
  menu_item: MenuItem;
}

export default function KitchenSpecialsPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [specials, setSpecials] = useState<SpecialItem[]>([]);

  // Selection state
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedItemName, setSelectedItemName] = useState("");
  const [period, setPeriod] = useState<string>("breakfast");

  // Quick create state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");

  const [loading, setLoading] = useState(true);
  const [showMenuSelector, setShowMenuSelector] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/menu');
      const json = await res.json();
      if (json.success) {
        const menuItems = json.data?.menuItems || [];
        const cats = json.data?.categories || [];
        const dailySpecials = json.data?.specials || [];
        setItems(menuItems);
        setCategories(cats);
        const specialsCat = cats.find((c: Category) => c.name === "Today's Specials");
        if (specialsCat) {
          setNewCategoryId(specialsCat.id);
        } else if (cats.length > 0) {
          setNewCategoryId(cats[0].id);
        }
        setSpecials(dailySpecials);
      }
    } catch (e) { console.error('fetchData error:', e); }
    setLoading(false);
  }

  async function handleQuickCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newPrice) return;
    setLoading(true);

    // 1. Create Menu Item via API
    let item: any;
    try {
      const createRes = await fetch('/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          price: parseFloat(newPrice),
          imageUrl: newImageUrl,
          categoryId: newCategoryId,
          available: true,
        }),
      });
      const createJson = await createRes.json();
      if (!createJson.success) {
        showError("Error creating menu item: " + (createJson.error || 'Unknown error'), `"please try again."`);
        setLoading(false);
        return;
      }
      item = createJson.data;
    } catch (err: any) {
      showError("Error creating menu item: " + err.message, `"please try again."`);
      setLoading(false);
      return;
    }

    // 2. Add as Special (via API to bypass RLS)
    const specialRes = await fetch('/api/kitchen/specials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_item_id: item.id,
        period,
        date: new Date().toISOString().split("T")[0],
      }),
    });
    const specialResult = await specialRes.json();
    const specialError = specialRes.ok ? null : { message: specialResult.error };

    if (!specialError) {
      setIsCreatingNew(false);
      setNewName("");
      setNewPrice("");
      setNewDescription("");
      setNewImageUrl("");
      fetchData();
    } else {
      showError(
        "Item created but failed to add as special: " + specialError.message,
        `"please try again."`
      );
    }
    setLoading(false);
  }

  async function addSpecial(itemId?: string) {
    const menuItemId = itemId || selectedItem;
    if (!menuItemId) return;

    // Check if this item is already a special for this period today
    const existing = specials.find(
      s => s.menu_item_id === menuItemId && s.period === period
    );

    if (existing) {
      const itemName = items.find(i => i.id === menuItemId)?.name || 'This item';
      showInfo(`${itemName} is already added as a ${period} special today!`, `Please choose a different item or period.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/kitchen/specials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_item_id: menuItemId,
          period,
          date: new Date().toISOString().split("T")[0],
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        console.error('Error adding special:', result.error);
        showError("Failed to add special: " + result.error, `"please try again."`);
      } else if (result.alreadyExists) {
        const itemName = selectedItemName || items.find(i => i.id === menuItemId)?.name || 'This item';
        showInfo(`${itemName} is already added as a ${period} special today!`, `Please choose a different item or period.`);
      } else {
        setSelectedItem("");
        setSelectedItemName("");
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error adding special:', err);
      showError("Failed to add special: " + err.message, `"please try again."`);
    }
    setLoading(false);
  }

  async function removeSpecial(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/kitchen/specials?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) {
        showError("Failed to remove special: " + result.error, `"please try again."`);
      }
    } catch (err: any) {
      showError("Failed to remove special: " + err.message, `"please try again."`);
    }
    await fetchData();
    setLoading(false);
  }

  return (
    <div style={{ background: "#fcfcfc", minHeight: "100vh", padding: "clamp(1rem, 3vw, 2rem)" }}>
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          background: "white",
          padding: "clamp(1.25rem, 5vw, 2.5rem)",
          borderRadius: "clamp(12px, 3vw, 24px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <AdminPageHeader title="Manage Daily Specials" icon={Sparkles} backHref="/kitchen" />

        <div
          style={{
            marginBottom: "clamp(1rem, 4vw, 2rem)",
            borderBottom: "1px solid #eee",
            paddingBottom: "0.5rem",
            display: "flex",
            gap: "clamp(1rem, 4vw, 2rem)",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          <button
            onClick={() => setIsCreatingNew(false)}
            style={{
              background: "none",
              border: "none",
              padding: "0.5rem 0",
              borderBottom: !isCreatingNew
                ? "3px solid var(--primary)"
                : "3px solid transparent",
              fontWeight: !isCreatingNew ? "bold" : "normal",
              cursor: "pointer",
              color: !isCreatingNew ? "var(--primary)" : "#888",
            }}
          >
            Pick Existing Item
          </button>
          <button
            onClick={() => setIsCreatingNew(true)}
            style={{
              background: "none",
              border: "none",
              padding: "0.5rem 0",
              borderBottom: isCreatingNew
                ? "3px solid var(--primary)"
                : "3px solid transparent",
              fontWeight: isCreatingNew ? "bold" : "normal",
              cursor: "pointer",
              color: isCreatingNew ? "var(--primary)" : "#888",
            }}
          >
            Create New Item
          </button>
        </div>

        {!isCreatingNew ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              marginBottom: "3rem",
            }}
          >
            {/* Period Selector - Make it prominent */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.75rem",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "#333",
                }}
              >
                Select Period
              </label>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => setPeriod("breakfast")}
                  style={{
                    flex: "1 1 auto",
                    minWidth: "140px",
                    padding: "clamp(0.75rem, 2vw, 1.25rem)",
                    borderRadius: "12px",
                    border: period === "breakfast" ? "2px solid #0369a1" : "2px solid #e0e0e0",
                    background: period === "breakfast" ? "#e0f2fe" : "white",
                    color: period === "breakfast" ? "#0369a1" : "#666",
                    fontWeight: period === "breakfast" ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    fontSize: "0.95rem",
                  }}
                >
                  🌅 Breakfast
                </button>
                <button
                  onClick={() => setPeriod("lunch")}
                  style={{
                    flex: "1 1 auto",
                    minWidth: "140px",
                    padding: "clamp(0.75rem, 2vw, 1.25rem)",
                    borderRadius: "12px",
                    border: period === "lunch" ? "2px solid #d97706" : "2px solid #e0e0e0",
                    background: period === "lunch" ? "#fef3c7" : "white",
                    color: period === "lunch" ? "#d97706" : "#666",
                    fontWeight: period === "lunch" ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    fontSize: "0.95rem",
                  }}
                >
                  🍽️ Lunch
                </button>
              </div>
            </div>

            {/* Menu Item Selector */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.75rem",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "#333",
                }}
              >
                Choose Menu Item
              </label>
              <button
                onClick={() => setShowMenuSelector(true)}
                style={{
                  width: "100%",
                  padding: "1.25rem",
                  borderRadius: "12px",
                  border: selectedItem ? "2px solid var(--primary)" : "2px dashed #ccc",
                  background: selectedItem ? "#fff5f5" : "white",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  color: selectedItem ? "var(--primary)" : "#666",
                  transition: "all 0.2s ease",
                  fontSize: "1rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = selectedItem ? "#fff0f0" : "#f9f9f9";
                  e.currentTarget.style.borderColor = "var(--primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = selectedItem ? "#fff5f5" : "white";
                  e.currentTarget.style.borderColor = selectedItem ? "var(--primary)" : "#ccc";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Plus size={20} />
                  <span>
                    {selectedItem
                      ? selectedItemName || items.find(i => i.id === selectedItem)?.name || "Select Item"
                      : "Click to Browse Menu Items"}
                  </span>
                </div>
                {selectedItem && (
                  <span style={{
                    fontSize: "0.75rem",
                    background: "var(--primary)",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "6px",
                  }}>
                    Selected
                  </span>
                )}
              </button>
            </div>

            {/* Add Button */}
            <Button
              onClick={() => addSpecial()}
              disabled={!selectedItem || loading}
              isLoading={loading}
              size="lg"
              style={{
                width: "100%",
                height: "56px",
                fontSize: "1rem",
                fontWeight: 700,
              }}
            >
              {selectedItem ? `Add to ${period === "breakfast" ? "Breakfast" : "Lunch"} Specials` : "Select an Item First"}
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleQuickCreate}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              marginBottom: "3rem",
            }}
          >
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: "240px" }}>
                <Input
                  label="Dish Name"
                  placeholder="e.g. Eggs Benedict"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <div style={{ flex: 1, minWidth: "120px" }}>
                <Input
                  label="Price (₹)"
                  type="number"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <Input
              label="Description"
              placeholder="Optional details about the dish..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />

            <ImageSelector
              label="Dish Image"
              value={newImageUrl}
              onChange={(val) => setNewImageUrl(val)}
            />

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.75rem",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "#333",
                }}
              >
                Select Period
              </label>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setPeriod("breakfast")}
                  style={{
                    flex: 1,
                    padding: "1rem",
                    borderRadius: "12px",
                    border: period === "breakfast" ? "2px solid #0369a1" : "2px solid #e0e0e0",
                    background: period === "breakfast" ? "#e0f2fe" : "white",
                    color: period === "breakfast" ? "#0369a1" : "#666",
                    fontWeight: period === "breakfast" ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    fontSize: "0.95rem",
                  }}
                >
                  🌅 Breakfast
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("lunch")}
                  style={{
                    flex: 1,
                    padding: "1rem",
                    borderRadius: "12px",
                    border: period === "lunch" ? "2px solid #d97706" : "2px solid #e0e0e0",
                    background: period === "lunch" ? "#fef3c7" : "white",
                    color: period === "lunch" ? "#d97706" : "#666",
                    fontWeight: period === "lunch" ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    fontSize: "0.95rem",
                  }}
                >
                  🍽️ Lunch
                </button>
              </div>
            </div>

            <Button type="submit" isLoading={loading} size="lg" style={{
              width: "100%",
              height: "56px",
              fontSize: "1rem",
              fontWeight: 700,
            }}>
              Create & Add to {period === "breakfast" ? "Breakfast" : "Lunch"} Specials
            </Button>
          </form>
        )}

        <h3
          style={{
            marginTop: "2rem",
            marginBottom: "1.5rem",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#333",
          }}
        >
          Today's Specials
        </h3>

        {loading ? (
          <div style={{
            textAlign: "center",
            padding: "3rem",
            color: "#999",
            fontSize: "0.95rem"
          }}>
            Loading specials...
          </div>
        ) : specials.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "3rem",
            background: "#f9f9f9",
            borderRadius: "12px",
            border: "2px dashed #ddd"
          }}>
            <p style={{ margin: 0, color: "#666", fontSize: "0.95rem" }}>
              No specials set for today. Add your first special above!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Breakfast Specials */}
            {specials.some(s => s.period === "breakfast") && (
              <div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "0.75rem",
                  padding: "0.5rem 0",
                }}>
                  <span style={{ fontSize: "1.5rem" }}>🌅</span>
                  <h4 style={{
                    margin: 0,
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#0369a1",
                  }}>
                    Breakfast Specials
                  </h4>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {specials
                    .filter(s => s.period === "breakfast")
                    .map((special) => (
                      <div
                        key={special.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "1rem 1.25rem",
                          background: "white",
                          borderRadius: "10px",
                          border: "2px solid #e0f2fe",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(3, 105, 161, 0.15)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {special.menu_item?.image_url && (
                            <img
                              src={special.menu_item.image_url}
                              alt={special.menu_item.name}
                              style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "8px",
                                objectFit: "cover",
                              }}
                            />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: "#333", fontSize: "1rem" }}>
                              {special.menu_item?.name}
                            </div>
                            {special.menu_item?.description && (
                              <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "2px" }}>
                                {special.menu_item.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeSpecial(special.id)}
                          disabled={loading}
                          style={{
                            color: "#dc2626",
                            padding: "8px",
                          }}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Lunch Specials */}
            {specials.some(s => s.period === "lunch") && (
              <div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "0.75rem",
                  padding: "0.5rem 0",
                }}>
                  <span style={{ fontSize: "1.5rem" }}>🍽️</span>
                  <h4 style={{
                    margin: 0,
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#d97706",
                  }}>
                    Lunch Specials
                  </h4>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {specials
                    .filter(s => s.period === "lunch")
                    .map((special) => (
                      <div
                        key={special.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "1rem 1.25rem",
                          background: "white",
                          borderRadius: "10px",
                          border: "2px solid #fef3c7",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(217, 119, 6, 0.15)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {special.menu_item?.image_url && (
                            <img
                              src={special.menu_item.image_url}
                              alt={special.menu_item.name}
                              style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "8px",
                                objectFit: "cover",
                              }}
                            />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: "#333", fontSize: "1rem" }}>
                              {special.menu_item?.name}
                            </div>
                            {special.menu_item?.description && (
                              <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "2px" }}>
                                {special.menu_item.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeSpecial(special.id)}
                          disabled={loading}
                          style={{
                            color: "#dc2626",
                            padding: "8px",
                          }}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showMenuSelector && (
        <MenuItemSelector
          items={items}
          categories={categories}
          onSelect={(item) => {
            setSelectedItem(item.id);
            setSelectedItemName(item.name);
          }}
          onClose={() => setShowMenuSelector(false)}
        />
      )}
    </div>
  );
}
