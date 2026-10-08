"use client";

import { ArrowRight, BusFront, Clock3 } from "lucide-react";
import { useCampus } from "@/components/layout/campus-context";
import { nextSampleDeparture } from "../lib/schedule";
import { useCampusClock } from "../lib/use-campus-clock";

export function TransportCard() {
  const now = useCampusClock();
  const { navigate } = useCampus();
  const next = now ? nextSampleDeparture(now) : null;
  return <section className="transport-card"><div className="transport-top"><span><BusFront size={18} />THE WAY HOME</span><span>Demo route</span></div><h2>Next scheduled bus</h2><div className="departure-time"><strong>{next?.time ?? "– – : – –"}</strong><span>{next?.day ?? "Checking schedule"}<small>Asia/Dhaka</small></span></div><div className="mini-journey"><span><i />Campus gate</span><span className="journey-line" /><span><i />Uttara</span></div><p className="transport-route">Route R01 <span>· via Birulia & Ashulia</span></p><div className="schedule-note"><Clock3 size={14} /><span>Scheduled, not live tracking</span></div><button className="transport-view" onClick={() => navigate("transport")}>View route & timetable<ArrowRight size={17} /></button></section>;
}
