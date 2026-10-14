// "Nu / Nästa" panel and today's agenda, built from timetable.json + yearplan.json.

import { esc } from "../lib/data.js";
import {
  weekKey, dateKey, isoDay, atTime, addDays, formatDuration, DAY_NAMES,
} from "../lib/time.js";

/** Everything we need to know about one calendar day. */
export function dayInfo(date, timetable, yearplan) {
  const weeks = yearplan?.weeks || {};
  const week = weeks[weekKey(date)];
  const special = yearplan?.specialDays?.find((s) => s.date === dateKey(date));
  const day = isoDay(date);

  if (day > 5) return { off: true, label: "Helg", blocks: [] };
  if (!week && Object.keys(weeks).length) return { off: true, label: "Utanför läsåret", blocks: [] };
  if (week?.break) return { off: true, label: week.break, blocks: [] };
  if (special?.noLessons) return { off: true, label: special.label, blocks: [] };

  const blocks = (timetable?.days?.[day] || []).map((b) => ({
    ...b,
    startAt: atTime(date, b.start),
    endAt: atTime(date, b.end),
    topic: b.plan ? week?.topics?.[b.plan] || null : null,
  }));
  return { off: false, label: special?.label || null, blocks };
}

/** The block running right now, and the next one (today or on a later school day). */
function findNowAndNext(now, timetable, yearplan) {
  const today = dayInfo(now, timetable, yearplan);
  const current = today.blocks.find((b) => b.startAt <= now && now < b.endAt) || null;

  let next = today.blocks.find((b) => b.startAt > now) || null;
  for (let i = 1; !next && i <= 60; i++) {
    const info = dayInfo(addDays(now, i), timetable, yearplan);
    next = info.blocks[0] || null;
  }
  return { today, current, next };
}

function whenText(block, now) {
  const mins = (block.startAt - now) / 60000;
  const sameDay = dateKey(block.startAt) === dateKey(now);
  if (sameDay) return `Börjar om ${formatDuration(mins)} · ${block.start}`;
  const tomorrow = dateKey(block.startAt) === dateKey(addDays(now, 1));
  const day = tomorrow ? "I morgon" : DAY_NAMES[block.startAt.getDay()];
  return `${day[0].toUpperCase()}${day.slice(1)} ${block.start}`;
}

function blockHTML(block, { tag, tagClass, now, isCurrent }) {
  const meta = [block.group, block.room && `Sal ${block.room}`, `${block.start}–${block.end}`].filter(Boolean).join(" · ");
  let extra = "";
  if (isCurrent) {
    const total = block.endAt - block.startAt;
    const pct = Math.min(100, Math.max(0, ((now - block.startAt) / total) * 100));
    extra = `
      <p class="now__count">Slutar om ${formatDuration((block.endAt - now) / 60000)}</p>
      <div class="now__bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></div>`;
  } else {
    extra = `<p class="now__count">${esc(whenText(block, now))}</p>`;
  }
  return `
    <div class="${block.type === "other" ? "now--other" : ""}">
      <span class="now__tag ${tagClass}">${tag}</span>
      <h2 class="now__course">${esc(block.course)}</h2>
      <p class="now__meta">${esc(meta)}</p>
      ${block.topic ? `<p class="now__topic"><span>Veckans tema</span>${esc(block.topic)}</p>` : ""}
      ${extra}
    </div>`;
}

function renderNow(el, now, timetable, yearplan) {
  const { today, current, next } = findNowAndNext(now, timetable, yearplan);

  let main;
  if (current) {
    main = blockHTML(current, { tag: "Nu", tagClass: "now__tag--live", now, isCurrent: true });
  } else if (today.off) {
    main = `<div>
      <span class="now__tag now__tag--off">${esc(today.label)}</span>
      <h2 class="now__course">Ingen undervisning</h2>
      <p class="now__meta">${esc(today.label === "Helg" ? "Vila upp dig." : "Enligt årsplanen.")}</p>
    </div>`;
  } else {
    const done = today.blocks.length && now >= today.blocks[today.blocks.length - 1].endAt;
    main = `<div>
      <span class="now__tag">Nu</span>
      <h2 class="now__course">${done ? "Klart för i dag" : "Rast / planering"}</h2>
      <p class="now__meta">${done ? "Inga fler pass i dag." : "Inget pass just nu."}</p>
    </div>`;
  }

  const side = next
    ? blockHTML(next, { tag: "Nästa", tagClass: "now__tag--next", now, isCurrent: false })
    : `<div><span class="now__tag now__tag--next">Nästa</span><p class="now__meta">Inget inplanerat.</p></div>`;

  el.innerHTML = `${main}<div class="now__side">${side}</div>`;
}

function renderAgenda(el, now, timetable, yearplan) {
  const today = dayInfo(now, timetable, yearplan);
  if (today.off) {
    el.innerHTML = `<li class="agenda__empty">${esc(today.label)} – inga pass i dag.</li>`;
    return;
  }
  const rows = today.blocks.map((b) => {
    const cls = [
      b.type === "other" && "is-other",
      now >= b.endAt && "is-past",
      b.startAt <= now && now < b.endAt && "is-current",
    ].filter(Boolean).join(" ");
    return `<li class="${cls}">
      <span class="agenda__time">${b.start}–${b.end}</span>
      <span><span class="agenda__course">${esc(b.course)}</span>${b.topic ? ` <span class="agenda__topic">· ${esc(b.topic)}</span>` : ""}</span>
      <span class="agenda__room">${esc(b.room || "")}</span>
    </li>`;
  });
  const label = today.label ? `<li class="agenda__empty">★ ${esc(today.label)}</li>` : "";
  el.innerHTML = label + (rows.join("") || `<li class="agenda__empty">Inga pass i dag.</li>`);
}

export function initSchedule({ timetable, yearplan, nowEl, agendaEl }) {
  const render = () => {
    const now = new Date();
    if (!timetable) {
      nowEl.innerHTML = `<p class="error">Kunde inte läsa data/timetable.json.</p>`;
      return;
    }
    renderNow(nowEl, now, timetable, yearplan);
    renderAgenda(agendaEl, now, timetable, yearplan);
  };
  render();
  setInterval(render, 30_000);
}
