"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth/context";
import { sanitizePhone } from "@/lib/utils/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Loading } from "@/components/ui/Loading";
import { showError, showSuccess, showConfirm } from "@/components/ui/Popup";
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  User,
  Mail,
  Phone,
  Shield,
  Check,
  X,
  MoreVertical,
  UserCircle,
  Key,
  UserPlus,
  Filter,
  ChevronDown,
} from "lucide-react";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";

interface UserRecord {
  id: string;
  phone: string;
  email: string;
  pin: string;
  name: string;
  role: string;
  parent_name?: string;
  created_at: string;
}

type RoleType = "all" | "RIDER" | "STAFF" | "KITCHEN" | "ADMIN" | "OUTSIDER";

export default function UserControlPage() {
  const { sessionToken, user: authUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleType>("all");

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    pin: "123456",
    role: "RIDER",
    parent_name: "",
  });
  const [submitting, setSubmitting] = useState(false);

  /** Build auth headers — session token + user ID for fallback */
  function getAuthHeaders(): Record<string, string> {
    const token = sessionToken || localStorage.getItem("session_token") || "";
    const userId =
      authUser?.id ||
      (() => {
        try {
          const stored = localStorage.getItem("auth_user");
          return stored ? JSON.parse(stored).id : "";
        } catch {
          return "";
        }
      })();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (userId) headers["X-User-Id"] = userId;
    return headers;
  }

  useEffect(() => {
    // Fetch as soon as we have any auth info
    const hasToken = sessionToken || localStorage.getItem("session_token");
    const hasUser = authUser?.id || localStorage.getItem("auth_user");
    if (hasToken || hasUser) fetchUsers();
  }, [sessionToken, authUser]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      const result = await response.json();
      if (result.success && result.data) {
        setUsers(result.data);
      } else {
        console.error("Failed to fetch users:", result.error);
      }
    } catch (err: any) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone?.includes(searchQuery);
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const phone = sanitizePhone(formData.phone);
    let email = formData.email?.trim();

    // Use dummy email if not provided for staff/riders
    if (
      !email &&
      (formData.role === "KITCHEN" ||
        formData.role === "RIDER" ||
        formData.role === "STAFF")
    ) {
      email = `${phone}@aicavalli.com`;
    }

    const isPhoneRequired =
      formData.role === "KITCHEN" ||
      formData.role === "RIDER" ||
      formData.role === "STAFF";
    if (isPhoneRequired && phone.length < 10) {
      showError(
        "Invalid Phone",
        "Valid 10-digit phone number is required for Staff and RIDERs.",
      );
      setSubmitting(false);
      return;
    }

    if (!email) {
      showError("Missing Email", "Email info is required.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          action: "create",
          userData: {
            ...formData,
            phone,
            email,
          },
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      setIsAddModalOpen(false);
      resetForm();
      fetchUsers();
      showSuccess("User Created", "The new user has been added successfully.");
    } catch (err: any) {
      showError("Error Adding User", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);

    const phone = sanitizePhone(formData.phone);
    let email = formData.email?.trim();

    if (
      !email &&
      (formData.role === "KITCHEN" ||
        formData.role === "RIDER" ||
        formData.role === "STAFF")
    ) {
      email = `${phone}@aicavalli.com`;
    }

    if (
      (formData.role === "KITCHEN" ||
        formData.role === "RIDER" ||
        formData.role === "STAFF") &&
      phone.length < 10
    ) {
      showError("Invalid Phone", "Valid 10-digit phone number is required.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          action: "update",
          userData: {
            id: currentUser.id,
            ...formData,
            phone,
            email,
          },
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      setIsEditModalOpen(false);
      fetchUsers();
      showSuccess("User Updated", "Changes have been saved successfully.");
    } catch (err: any) {
      showError("Error Updating User", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await showConfirm(
      "Delete User",
      "This will permanently remove the user. This action cannot be undone.",
      "Delete",
      "Cancel",
    );
    if (!confirmed) return;

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          action: "delete",
          userData: { id },
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      fetchUsers();
      showSuccess("User Deleted", "The user has been permanently removed.");
    } catch (err: any) {
      showError("Error Deleting User", err.message);
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      phone: "",
      email: "",
      pin: "123456",
      role: "RIDER",
      parent_name: "",
    });
  }

  function openEdit(user: UserRecord) {
    setCurrentUser(user);
    setFormData({
      name: user.name,
      phone: user.phone || "",
      email: user.email || "",
      pin: user.pin,
      role: user.role,
      parent_name: user.parent_name || "",
    });
    setIsEditModalOpen(true);
  }

  if (loading) return <Loading fullScreen message="Managing Users..." />;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgb(248, 249, 250)",
        padding: "clamp(1rem, 3vw, 2.5rem)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Background Pattern */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            "radial-gradient(circle at 20px 20px, rgba(var(--primary-rgb), 0.03) 1px, transparent 0)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 'clamp(1.5rem, 5vw, 3rem)' }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
              flexWrap: "wrap",
              gap: "clamp(1rem, 3vw, 1.5rem)",
            }}
          >
            <AdminPageHeader
              title="User Control"
              subtitle="Manage staff, riders, and administrative access"
              icon={Users}
              backHref="/admin"
            />

            <button
              onClick={() => {
                resetForm();
                setIsAddModalOpen(true);
              }}
              style={{
                background: "var(--primary)",
                color: "white",
                padding: "12px 28px",
                borderRadius: "16px",
                height: "54px",
                border: "none",
                fontSize: "1rem",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 8px 16px rgba(var(--primary-rgb), 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                transition: "all 0.3s ease",
                flex: '1 1 auto',
                justifyContent: 'center',
                minWidth: '220px'
              }}
            >
              <UserPlus size={20} />
              REGISTER NEW USER
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div
          style={{
            background: "white",
            padding: "clamp(1.25rem, 4vw, 1.75rem)",
            borderRadius: "24px",
            border: "1px solid rgba(var(--primary-rgb), 0.15)",
            marginBottom: "2.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            boxShadow: "0 8px 32px rgba(var(--primary-rgb), 0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative", flex: 1, minWidth: "min(100%, 300px)" }}>
              <Search
                style={{
                  position: "absolute",
                  left: "18px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
                size={20}
              />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "16px 16px 16px 54px",
                  borderRadius: "16px",
                  border: "2px solid rgba(var(--primary-rgb), 0.1)",
                  fontSize: "1rem",
                  outline: "none",
                  transition: "all 0.3s ease",
                  background: "#f8fafc",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                overflowX: "auto",
                paddingBottom: "4px",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              <style>{`div::-webkit-scrollbar { display: none; }`}</style>
              {["all", "RIDER", "STAFF", "KITCHEN", "ADMIN", "OUTSIDER"].map(
                (role) => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role as RoleType)}
                    style={{
                      padding: "clamp(8px, 1.5vw, 12px) clamp(16px, 2vw, 22px)",
                      borderRadius: "24px",
                      border: "1.5px solid",
                      transition: "all 0.3s ease",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      fontSize: "0.85rem",
                      fontWeight: "700",
                      background:
                        roleFilter === role ? "var(--primary)" : "white",
                      borderColor:
                        roleFilter === role
                          ? "var(--primary)"
                          : "rgba(var(--primary-rgb), 0.15)",
                      color:
                        roleFilter === role ? "white" : "var(--text-muted)",
                    }}
                  >
                    {role === "all"
                      ? "All Users"
                      : role === "RIDER"
                        ? "Rider"
                        : role === "STAFF"
                          ? "Staff"
                          : role === "KITCHEN"
                            ? "Kitchen"
                            : role === "ADMIN"
                              ? "Admin"
                              : role === "OUTSIDER"
                                ? "Guests"
                                : role}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Users Table Container */}
        <div
          style={{
            background: "white",
            borderRadius: "28px",
            border: "1px solid rgba(var(--primary-rgb), 0.15)",
            boxShadow: "0 8px 32px rgba(var(--primary-rgb), 0.05)",
            width: "100%",
            overflowX: "auto",
            scrollbarWidth: "thin",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <th
                  style={{
                    padding: "20px 24px",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  User
                </th>
                <th
                  style={{
                    padding: "20px 24px",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Contact
                </th>
                <th
                  style={{
                    padding: "20px 24px",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Role
                </th>
                <th
                  style={{
                    padding: "20px 24px",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Details
                </th>
                <th
                  style={{
                    padding: "20px 24px",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    textAlign: "right",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "100px",
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    <Users
                      size={48}
                      strokeWidth={1}
                      style={{ marginBottom: "16px", opacity: 0.3 }}
                    />
                    <p>No users found matching your criteria</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background 0.2s",
                    }}
                    className="user-row"
                  >
                    <td style={{ padding: "20px 24px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "16px",
                        }}
                      >
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "12px",
                            background: "rgba(var(--primary-rgb), 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--primary)",
                          }}
                        >
                          <UserCircle size={24} />
                        </div>
                        <div>
                          <div style={{ fontWeight: "700", color: "#1e293b" }}>
                            {u.name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--primary)",
                              fontWeight: 600,
                            }}
                          >
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "20px 24px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "#475569",
                          fontSize: "0.9rem",
                        }}
                      >
                        <Phone size={14} />
                        {u.phone || "N/A"}
                      </div>
                    </td>
                    <td style={{ padding: "20px 24px" }}>
                      <span
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          fontSize: "0.75rem",
                          fontWeight: "800",
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          background:
                            u.role === "ADMIN"
                              ? "#fef2f2"
                              : u.role === "RIDER"
                                ? "#f0f9ff"
                                : u.role === "OUTSIDER"
                                  ? "#f5f3ff"
                                  : u.role === "STAFF"
                                    ? "#fff7ed"
                                    : "#f0fdf4",
                          color:
                            u.role === "ADMIN"
                              ? "#ef4444"
                              : u.role === "RIDER"
                                ? "#0ea5e9"
                                : u.role === "OUTSIDER"
                                  ? "#8b5cf6"
                                  : u.role === "STAFF"
                                    ? "#f59e0b"
                                    : "#10b981",
                          border: `1px solid ${u.role === "ADMIN" ? "#fee2e2" : u.role === "RIDER" ? "#e0f2fe" : u.role === "OUTSIDER" ? "#ede9fe" : u.role === "STAFF" ? "#ffedd5" : "#dcfce7"}`,
                        }}
                      >
                        {u.role === "RIDER"
                          ? "RIDER"
                          : u.role === "STAFF"
                            ? "Staff"
                            : u.role === "KITCHEN"
                              ? "Kitchen"
                              : u.role === "OUTSIDER"
                                ? "Guest"
                                : u.role}
                      </span>
                    </td>
                    <td style={{ padding: "20px 24px" }}>
                      {u.role === "RIDER" ? (
                        <div style={{ fontSize: "0.85rem" }}>
                          <span style={{ color: "#64748b" }}>Parent: </span>
                          <span style={{ fontWeight: "600" }}>
                            {u.parent_name || "Not provided"}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                          N/A
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "20px 24px", textAlign: "right" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "8px",
                        }}
                      >
                        <Button
                          onClick={() => openEdit(u)}
                          variant="ghost"
                          style={{
                            width: "36px",
                            height: "36px",
                            padding: 0,
                            borderRadius: "8px",
                          }}
                        >
                          <Edit2 size={18} color="#64748b" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(u.id)}
                          variant="ghost"
                          style={{
                            width: "36px",
                            height: "36px",
                            padding: 0,
                            borderRadius: "8px",
                          }}
                        >
                          <Trash2 size={18} color="#ef4444" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "2rem",
          }}
        >
          <div
            style={{
              background: "white",
              width: "100%",
              maxWidth: "550px",
              borderRadius: "28px",
              padding: "clamp(1.5rem, 5vw, 3rem)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              position: "relative",
              border: "1px solid rgba(var(--primary-rgb), 0.1)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setIsEditModalOpen(false);
              }}
              style={{
                position: "absolute",
                right: "28px",
                top: "28px",
                background: "white",
                border: "1px solid rgba(0,0,0,0.05)",
                cursor: "pointer",
                color: "var(--text-muted)",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--primary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-muted)")
              }
            >
              <X size={20} />
            </button>

            <div style={{ marginBottom: "2.5rem" }}>
              <h2
                style={{
                  fontSize: "2rem",
                  fontWeight: "800",
                  marginBottom: "0.75rem",
                  color: "var(--text)",
                  letterSpacing: "-0.02em",
                }}
              >
                {isAddModalOpen ? "Register New User" : "Update Access"}
              </h2>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "1rem",
                  fontStyle: "italic",
                }}
              >
                {isAddModalOpen
                  ? "Create a secure access account for your team."
                  : `Modifying settings for ${formData.name}`}
              </p>
            </div>

            <form
              onSubmit={isAddModalOpen ? handleAdd : handleEdit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              <ItalianFormField
                label="Full Name"
                icon={<User size={14} />}
                value={formData.name}
                onChange={(e: any) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter full name"
                required
              />

              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                {!(
                  formData.role === "KITCHEN" ||
                  formData.role === "RIDER" ||
                  formData.role === "STAFF"
                ) ? (
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <ItalianFormField
                      label="Email Address"
                      icon={<Mail size={14} />}
                      value={formData.email}
                      onChange={(e: any) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="user@example.com (Optional)"
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      minWidth: "200px",
                      display: "flex",
                      alignItems: "center",
                      opacity: 0.6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      <Mail
                        size={14}
                        style={{ marginRight: "8px", verticalAlign: "middle" }}
                      />
                      Email linked to Phone automatically
                    </div>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <Select
                    label="Role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                  >
                    <option value="RIDER">RIDER</option>
                    <option value="STAFF">Staff</option>
                    <option value="KITCHEN">Kitchen Manager</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OUTSIDER">Guest</option>
                  </Select>
                </div>
              </div>

              {isAddModalOpen && (
                <div
                  style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}
                >
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <ItalianFormField
                      label={
                        formData.role === "KITCHEN" ||
                          formData.role === "RIDER" ||
                          formData.role === "STAFF"
                          ? "Phone Number"
                          : "Phone (Optional)"
                      }
                      icon={<Phone size={14} />}
                      value={formData.phone}
                      onChange={(e: any) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder={
                        formData.role === "KITCHEN" ||
                          formData.role === "RIDER" ||
                          formData.role === "STAFF"
                          ? "10 digit number"
                          : "Optional (10 digits)"
                      }
                      required={
                        formData.role === "KITCHEN" ||
                        formData.role === "RIDER" ||
                        formData.role === "STAFF"
                      }
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <ItalianFormField
                      label="Auth PIN"
                      icon={<Key size={14} />}
                      value={formData.pin}
                      onChange={(e: any) =>
                        setFormData({ ...formData, pin: e.target.value })
                      }
                      placeholder="6+ characters"
                      required
                      minLength={6}
                      type="password"
                    />
                  </div>
                </div>
              )}

              {formData.role === "RIDER" && (
                <ItalianFormField
                  label="Parent/Guardian Name"
                  icon={<Users size={14} />}
                  value={formData.parent_name}
                  onChange={(e: any) =>
                    setFormData({ ...formData, parent_name: e.target.value })
                  }
                  placeholder="Responsible party name"
                  required
                />
              )}

              <div
                style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  style={{
                    flex: 1,
                    height: "58px",
                    borderRadius: "16px",
                    border: "2px solid rgba(var(--primary-rgb), 0.15)",
                    background: "white",
                    color: "var(--text-muted)",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(0,0,0,0.02)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "white")
                  }
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 2,
                    height: "58px",
                    borderRadius: "16px",
                    background: "var(--primary)",
                    color: "white",
                    border: "none",
                    fontWeight: "800",
                    fontSize: "1rem",
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: "0 8px 16px rgba(var(--primary-rgb), 0.25)",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!submitting)
                      e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {submitting
                    ? "PROCESSING..."
                    : isAddModalOpen
                      ? "CREATE ACCOUNT"
                      : "SAVE CHANGES"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
                .user-row:hover {
                    background: rgba(var(--primary-rgb), 0.02);
                }
                select:focus {
                    border-color: var(--primary) !important;
                    box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.08) !important;
                    outline: none;
                }
            `}</style>
    </div>
  );
}

function ItalianFormField({
  label,
  icon,
  ...props
}: {
  label: React.ReactNode;
  icon?: React.ReactNode;
  [x: string]: any;
}) {
  return (
    <div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "12px",
          fontSize: "0.75rem",
          fontWeight: "700",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {icon}
        {label}
      </label>
      <Input
        {...props}
        style={{
          width: "100%",
          padding: "16px 18px",
          borderRadius: "14px",
          border: "2px solid rgba(var(--primary-rgb), 0.15)",
          fontSize: "1rem",
          transition: "all 0.3s ease",
          outline: "none",
          background: "white",
        }}
        onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
          e.target.style.borderColor = "var(--primary)";
          e.target.style.boxShadow = "0 0 0 4px rgba(var(--primary-rgb), 0.08)";
        }}
        onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
          e.target.style.borderColor = "rgba(var(--primary-rgb), 0.15)";
          e.target.style.boxShadow = "none";
        }}
      />
    </div>
  );
}

