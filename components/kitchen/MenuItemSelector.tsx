"use client";

import { useState, useMemo } from "react";
import { X, Search } from "lucide-react";
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

interface MenuItemSelectorProps {
  items: MenuItem[];
  categories: Category[];
  onSelect: (item: MenuItem) => void;
  onClose: () => void;
}

export function MenuItemSelector({
  items,
  categories,
  onSelect,
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

  const renderItemsContent = () => {
    if (activeCategory === "all") {
      // Show all items organized by category
      return displayedCategories.map((category) => {
        const categoryItems = itemsByCategory[category.id] || [];
        const filtered = categoryItems.filter((item) => {
          const matchesSearch =
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description &&
              item.description
                .toLowerCase()
                .includes(searchQuery.toLowerCase()));
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
      // Show only items from active category
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
            No items found matching "{searchQuery}"
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

  const renderItemCard = (item: MenuItem) => (
    <div
      key={item.id}
      onClick={() => {
        onSelect(item);
        onClose();
      }}
      style={{
        cursor: "pointer",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        overflow: "hidden",
        transition: "all 0.2s ease",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "white",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(169, 30, 34, 0.2)";
        e.currentTarget.style.transform = "translateY(-4px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Image */}
      <div
        style={{
          width: "100%",
          height: "120px",
          backgroundColor: "#f5f5f5",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
        <div
          style={{
            fontSize: "0.8rem",
            color: "#A91E22",
            fontWeight: 800,
            marginTop: "auto",
          }}
        >
          ₹{item.price.toFixed(2)}
        </div>
      </div>
    </div>
  );

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
          <h2
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--text)",
            }}
          >
            Select Item to Add
          </h2>
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

                .hover-lift:hover img {
                    transform: scale(1.1);
                }
            `}</style>
    </>
  );
}
