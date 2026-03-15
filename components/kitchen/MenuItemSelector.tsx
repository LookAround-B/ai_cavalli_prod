"use client";

import { useState, useMemo } from "react";
import { X, Plus, Minus } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { CategoryBadge } from "@/components/ui/CategoryBadge";

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  available: boolean;
  category_id?: string;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface SelectedItem {
  menuItemId: string;
  quantity: number;
}

interface MenuItemSelectorProps {
  items: MenuItem[];
  categories: Category[];
  selectedItems?: SelectedItem[];
  onSelect: (item: MenuItem) => void;
  onUpdateQuantity?: (menuItemId: string, quantity: number) => void;
  onRemoveItem?: (menuItemId: string) => void;
  onClose: () => void;
}

export function MenuItemSelector({
  items,
  categories,
  selectedItems = [],
  onSelect,
  onUpdateQuantity,
  onRemoveItem,
  onClose,
}: MenuItemSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        activeCategory === "all" || item.category_id === activeCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [items, searchQuery, activeCategory]);

  const displayedCategories = useMemo(() => {
    return categories
      .filter((cat) => cat.name !== "Fixed Menu")
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [categories]);

  // Group items by category for organized display
  const itemsByCategory = useMemo(() => {
    const grouped: { [key: string]: MenuItem[] } = {};
    displayedCategories.forEach((cat) => {
      grouped[cat.id] = items.filter((item) => item.category_id === cat.id);
    });
    return grouped;
  }, [items, displayedCategories]);

  const getSelectedQuantity = (itemId: string): number => {
    const found = selectedItems.find((s) => s.menuItemId === itemId);
    return found ? found.quantity : 0;
  };

  const totalSelectedCount = selectedItems.reduce((sum, s) => sum + s.quantity, 0);

  const renderItemsContent = () => {
    if (activeCategory === "all") {
      return displayedCategories.map((category) => {
        const categoryItems = itemsByCategory[category.id] || [];
        const filtered = categoryItems.filter((item) => {
          const matchesSearch =
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description &&
              item.description.toLowerCase().includes(searchQuery.toLowerCase()));
          return matchesSearch;
        });

        if (filtered.length === 0) return null;

        return (
          <div key={category.id}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-3) var(--space-2) var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "18px",
                  background: "#A91E22",
                  borderRadius: "2px",
                }}
              />
              <h3
                style={{
                  margin: 0,
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {category.name}
              </h3>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: "var(--space-4)",
                padding: "0 var(--space-2) var(--space-4)",
              }}
            >
              {filtered.map((item) => renderItemCard(item))}
            </div>
          </div>
        );
      });
    } else {
      const filtered = filteredItems;
      if (filtered.length === 0) {
        return (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "3rem 1rem",
              color: "var(--text-muted)",
              fontSize: "0.9rem",
            }}
          >
            No items found matching &ldquo;{searchQuery}&rdquo;
          </div>
        );
      }
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "var(--space-4)",
            padding: "var(--space-2)",
          }}
        >
          {filtered.map((item) => renderItemCard(item))}
        </div>
      );
    }
  };

  const renderItemCard = (item: MenuItem) => {
    const qty = getSelectedQuantity(item.id);
    const isSelected = qty > 0;

    return (
      <div
        key={item.id}
        style={{
          borderRadius: "12px",
          border: isSelected ? "2px solid #A91E22" : "1px solid var(--border)",
          overflow: "hidden",
          transition: "all 0.2s ease",
          display: "flex",
          flexDirection: "column",
          backgroundColor: isSelected ? "#FFF8F8" : "white",
          position: "relative",
        }}
      >
        {/* Quantity badge */}
        {isSelected && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "#A91E22",
              color: "white",
              fontWeight: 800,
              fontSize: "0.7rem",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              boxShadow: "0 2px 6px rgba(169, 30, 34, 0.4)",
            }}
          >
            {qty}
          </div>
        )}

        {/* Image - clickable to add */}
        <div
          onClick={() => onSelect(item)}
          style={{
            width: "100%",
            height: "120px",
            backgroundColor: "#f5f5f5",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
          }}
        >
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transition: "transform 0.3s ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLImageElement).style.transform = "scale(1.15)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLImageElement).style.transform = "scale(1)";
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "#e5e5e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
                fontSize: "0.65rem",
                textAlign: "center",
                padding: "8px",
                fontWeight: 600,
              }}
            >
              No Image Available
            </div>
          )}
        </div>

        {/* Info */}
        <div
          style={{
            padding: "10px 12px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "70px",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: "6px",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {item.name}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
            <div
              style={{
                fontSize: "0.8rem",
                color: "#A91E22",
                fontWeight: 800,
              }}
            >
              ₹{item.price.toFixed(2)}
            </div>

            {/* Add / Quantity controls */}
            {isSelected ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#FEF2F2",
                  borderRadius: "8px",
                  padding: "2px 4px",
                  border: "1px solid #FECACA",
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (qty <= 1) {
                      onRemoveItem?.(item.id);
                    } else {
                      onUpdateQuantity?.(item.id, qty - 1);
                    }
                  }}
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "6px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#A91E22",
                    padding: 0,
                  }}
                >
                  <Minus size={13} />
                </button>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "#A91E22",
                    minWidth: "14px",
                    textAlign: "center",
                  }}
                >
                  {qty}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity?.(item.id, qty + 1);
                  }}
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "6px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#A91E22",
                    padding: 0,
                  }}
                >
                  <Plus size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item);
                }}
                style={{
                  background: "#A91E22",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "4px 10px",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.5px",
                }}
              >
                ADD
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 1100,
          animation: "fadeIn 0.15s ease-out",
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "white",
          borderRadius: "16px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
          zIndex: 1110,
          maxWidth: "90vw",
          maxHeight: "90vh",
          width: "600px",
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.3s ease-out",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-6)",
            borderBottom: "1px solid var(--border)",
            backgroundColor: "#FDFBF7",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              Select Items
            </h2>
            {totalSelectedCount > 0 && (
              <span
                style={{
                  background: "#A91E22",
                  color: "white",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  padding: "2px 10px",
                  borderRadius: "20px",
                }}
              >
                {totalSelectedCount} added
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <button
              onClick={onClose}
              style={{
                background: "#A91E22",
                color: "white",
                border: "none",
                cursor: "pointer",
                padding: "8px 20px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            >
              Done
            </button>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
              }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div
          style={{
            padding: "var(--space-4)",
            borderBottom: "1px solid var(--border)",
            backgroundColor: "white",
          }}
        >
          <SearchInput
            placeholder="Search menu items..."
            value={searchQuery}
            onSearch={setSearchQuery}
          />
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            backgroundColor: "#FAFAF8",
          }}
        >
          {/* Categories */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--border)",
              overflowX: "auto",
              backgroundColor: "white",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              position: "sticky",
              top: 0,
              zIndex: 20,
            }}
          >
            <CategoryBadge
              name="All"
              isActive={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            />
            {displayedCategories.map((cat) => (
              <CategoryBadge
                key={cat.id}
                name={cat.name}
                isActive={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
              />
            ))}
          </div>

          {/* Content */}
          <div
            style={{
              padding: "var(--space-3)",
            }}
          >
            {renderItemsContent()}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -45%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
}
