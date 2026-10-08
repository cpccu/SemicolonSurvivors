"use client";

import { Search, Bell, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCampus } from "./campus-context";
import { AccountActions } from "./account-actions";
import { campusAccountPresentation } from "./account-presentation";
import { campusModules } from "@/modules/campus/data/modules";

export function TopNavigation() {
  const { session, active, navigate, openSearch, openModules } = useCampus();
  const account = campusAccountPresentation(session);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="top-navigation">
      <div className="top-nav-container">
        {/* Logo / Brand */}
        <div className="top-nav-brand">
          <button
            className="brand-button"
            aria-label="CampusOS home"
            onClick={() => {
              navigate("today");
              setMobileMenuOpen(false);
            }}
          >
            <div className="brand-logo">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="8" fill="url(#logo-gradient)" />
                <path d="M16 8L22 12V20L16 24L10 20V12L16 8Z" fill="white" fillOpacity="0.9" />
                <defs>
                  <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366F1" />
                    <stop offset="1" stopColor="#A855F7" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="brand-text">CampusOS</span>
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <div className="top-nav-links">
          <button
            className={`nav-link ${active === "today" ? "active" : ""}`}
            onClick={() => navigate("today")}
          >
            <span>Today</span>
          </button>
          {campusModules.slice(0, 5).map((module) => (
            <button
              key={module.id}
              className={`nav-link ${active === module.id ? "active" : ""}`}
              onClick={() => navigate(module.id)}
            >
              <span>{module.shortTitle}</span>
            </button>
          ))}
          <button
            className="nav-link nav-link-more"
            onClick={openModules}
            aria-label="More modules"
          >
            <span>More</span>
          </button>
        </div>

        {/* Right Side Actions */}
        <div className="top-nav-actions">
          {/* Search Button */}
          <button
            className="nav-action-button"
            aria-label="Search campus (⌘K)"
            onClick={openSearch}
          >
            <Search size={20} />
          </button>

          {/* Notifications Button */}
          <button
            className="nav-action-button"
            aria-label="Notifications"
          >
            <Bell size={20} />
            <span className="notification-badge">3</span>
          </button>

          {/* Account Section */}
          {account.active && (
            <div className="top-nav-account">
              <div className="account-info">
                <span className="account-name">{account.name}</span>
                <span className="account-role">{account.roleSummary}</span>
              </div>
              <AccountActions />
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-toggle"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-menu-content">
            <button
              className={`mobile-nav-link ${active === "today" ? "active" : ""}`}
              onClick={() => {
                navigate("today");
                setMobileMenuOpen(false);
              }}
            >
              Today
            </button>
            {campusModules.map((module) => (
              <button
                key={module.id}
                className={`mobile-nav-link ${active === module.id ? "active" : ""}`}
                onClick={() => {
                  navigate(module.id);
                  setMobileMenuOpen(false);
                }}
              >
                {module.shortTitle}
              </button>
            ))}
            <button
              className="mobile-nav-link"
              onClick={() => {
                openModules();
                setMobileMenuOpen(false);
              }}
            >
              All Modules
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
