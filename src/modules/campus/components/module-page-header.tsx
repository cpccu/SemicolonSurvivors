import type { ReactNode } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { getModule, type ModuleId } from "../data/modules";
import styles from "./module-page-header.module.css";

export function ModulePageHeader({ module, action, children, preview = true }: { module: ModuleId; action?: ReactNode; children?: ReactNode; preview?: boolean }) {
  const item = getModule(module);
  return <>
    <header className={styles.header} data-module-header={module}>
      <div className={styles.headerCopy}>
        <div className={styles.headerKicker}><span className="eyebrow">CAMPUSOS / MODULE {item.number}</span><span className={styles.headerIndex}>{item.number}</span></div>
        <h1>{item.title}<span>.</span></h1>
        <p>{item.description}</p>
        <div className={styles.statusRow} aria-label="Module data status">
           <span className={styles.statusBadge}>Live campus data</span>
           {preview && <span className={`${styles.statusBadge} ${styles.statusBadgeSynthetic}`}>Demo material</span>}
        </div>
        {action && <div className={styles.headerAction}>{action}</div>}
      </div>
      <div className={styles.heroArtwork} aria-label="Original geometric campus map illustration" role="img">
        <span className={styles.heroLabel}>CAMPUSOS / ACTIVE SURFACE</span>
        <svg viewBox="0 0 320 170" aria-hidden="true" focusable="false">
          <path className={styles.mapFill} d="M32 38 87 19l51 18 43-11 62 27-25 38-42 7-31 35-64-17-42-38Z" />
          <path className={styles.mapFillWarm} d="m87 19 51 18-11 46-54 13-31-38Z" />
          <polyline points="40,118 95,91 144,95 177,54 239,53 281,77" />
          <polyline points="79,31 111,62 145,95 197,112 256,106" />
          <line x1="153" y1="27" x2="162" y2="147" />
          <line x1="48" y1="72" x2="272" y2="72" />
          <circle cx="95" cy="91" r="7" />
          <circle cx="177" cy="54" r="7" />
          <circle cx="239" cy="53" r="7" />
          <circle className={styles.mapDot} cx="197" cy="112" r="5" />
          <circle className={styles.mapDot} cx="111" cy="62" r="4" />
        </svg>
      </div>
    </header>
    <nav className={styles.sectionNav} aria-label={`${item.title} sections`}>
      <span className={styles.sectionLabel}>SECTION MAP</span>
      <a className={styles.sectionLink} href={`#module-${module}-content`}>Browse module <ArrowDown size={13} aria-hidden="true" /></a>
      <a className={styles.sectionLink} href={`#module-${module}-access`}>Data boundary <ArrowDown size={13} aria-hidden="true" /></a>
      <a className={`${styles.sectionLink} ${styles.sectionAction}`} href="#main-content">Back to workspace <ArrowRight size={13} aria-hidden="true" /></a>
    </nav>
    <div className={styles.disclosure} id={`module-${module}-access`}>
      <span>DATA NOTE</span>
       <p>{children ?? "Campus records are filtered by your account and assigned scope when access is required."}</p>
    </div>
  </>;
}
