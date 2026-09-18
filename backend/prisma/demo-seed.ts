import argon2 from "argon2"
import { createHash } from "node:crypto"
import { resolve } from "node:path"
import sharp from "sharp"
import { LocalImageStorage } from "../src/shared/storage/local-image-storage.js"
import { processImage } from "../src/shared/storage/image-processor.js"
import type { ImageStorage } from "../src/shared/storage/image-storage.js"
import type { PrismaClient } from "../src/generated/prisma/client.js"
import { loadDemoLocations, loadDemoSeedConfig, parseDemoSeedArgs, type DemoSeedConfig } from "./demo-seed-config.js"

type Point = { id: string; label: string; latitude: number; longitude: number }
type Locations = { schemaVersion: 1; cityLabel: string; defaultCenter: { latitude: number; longitude: number; zoom: number }; points: Point[] }

const users = [
  ["10000000-0000-4000-8000-000000000001", "Demo Citizen One", "citizen.one@floodready.invalid", "USER", "DEMO_CITIZEN_PASSWORD"],
  ["10000000-0000-4000-8000-000000000002", "Demo Citizen Two", "citizen.two@floodready.invalid", "USER", "DEMO_CITIZEN_PASSWORD"],
  ["10000000-0000-4000-8000-000000000003", "Demo Moderator", "moderator@floodready.invalid", "MODERATOR", "DEMO_MODERATOR_PASSWORD"],
  ["10000000-0000-4000-8000-000000000004", "Demo Administrator", "administrator@floodready.invalid", "ADMIN", "DEMO_ADMIN_PASSWORD"],
] as const
const reports = [
  ["20000000-0000-4000-8000-000000000001", 1, 1, "ROAD_WATERLOGGING", "MINOR", "SUBMITTED", null, "2026-07-01T09:05:00.000Z"],
  ["20000000-0000-4000-8000-000000000002", 2, 2, "FLOODED_ROAD", "MODERATE", "PENDING_REVIEW", "30000000-0000-4000-8000-000000000001", "2026-07-01T09:20:00.000Z"],
  ["20000000-0000-4000-8000-000000000003", 1, 3, "FLOODED_ROAD", "SEVERE", "PROVISIONAL", "30000000-0000-4000-8000-000000000001", "2026-07-01T09:35:00.000Z"],
  ["20000000-0000-4000-8000-000000000004", 2, 4, "OPEN_MANHOLE", "IMPASSABLE", "VERIFIED", "30000000-0000-4000-8000-000000000002", "2026-07-01T09:50:00.000Z"],
  ["20000000-0000-4000-8000-000000000005", 1, 5, "CLOGGED_DRAIN", "MODERATE", "DISPUTED", "30000000-0000-4000-8000-000000000003", "2026-07-01T10:05:00.000Z"],
  ["20000000-0000-4000-8000-000000000006", 2, 6, "FALLEN_TREE", "SEVERE", "RESOLVED", "30000000-0000-4000-8000-000000000004", "2026-07-01T10:20:00.000Z"],
  ["20000000-0000-4000-8000-000000000007", 1, 7, "STRANDED_VEHICLE", "SEVERE", "STALE", null, "2026-07-01T10:35:00.000Z"],
  ["20000000-0000-4000-8000-000000000008", 2, 8, "UNDERPASS_FLOODING", "MODERATE", "REJECTED", null, "2026-07-01T10:50:00.000Z"],
] as const
const incidents = [
  ["30000000-0000-4000-8000-000000000001", 2, "FLOODED_ROAD", "SEVERE", "ACTIVE", [2, 3]],
  ["30000000-0000-4000-8000-000000000002", 4, "OPEN_MANHOLE", "IMPASSABLE", "MONITORING", [4]],
  ["30000000-0000-4000-8000-000000000003", 5, "CLOGGED_DRAIN", "MODERATE", "RESOLVED", [5]],
  ["30000000-0000-4000-8000-000000000004", 6, "FALLEN_TREE", "SEVERE", "STALE", [6]],
] as const
const createdAt = new Date("2026-07-01T08:00:00.000Z")
const reportTime = (value: string) => new Date(value)
const must = <T>(value: T | undefined): T => value ?? (() => { throw new Error("Missing fixed demo value") })()
const transition = (index: number, step: number) => new Date(reportTime(must(reports[index])[7]).getTime() + step * 60_000)

const validateLocations = (value: unknown): Locations => {
  if (value === null || typeof value !== "object") throw new Error("Invalid demo locations")
  const input = value as Record<string, unknown>
  const safeLabel = (label: string, maximum: number) => {
    if (label.length < 1 || label.length > maximum || label !== label.trim() || label !== label.normalize("NFC") || /[\r\n\u2028\u2029<>\u0026]/u.test(label) || label.includes(String.fromCharCode(0)) || /[\p{Cc}\p{Cf}]/u.test(label)) throw new Error("Invalid demo label")
  }
  if (input.schemaVersion !== 1 || typeof input.cityLabel !== "string" || !Array.isArray(input.points) || Object.keys(input).sort().join(",") !== "cityLabel,defaultCenter,points,schemaVersion") throw new Error("Invalid demo locations")
  safeLabel(input.cityLabel, 80)
  const center = input.defaultCenter as Record<string, unknown>
  if (center === null || typeof center !== "object" || Object.keys(center).sort().join(",") !== "latitude,longitude,zoom") throw new Error("Invalid demo center")
  const points = input.points.map((point) => {
    if (point === null || typeof point !== "object") throw new Error("Invalid demo point")
    const item = point as Record<string, unknown>
    if (Object.keys(item).sort().join(",") !== "id,label,latitude,longitude") throw new Error("Invalid demo point")
    if (typeof item.id !== "string" || typeof item.label !== "string" || typeof item.latitude !== "number" || typeof item.longitude !== "number") throw new Error("Invalid demo point")
    if (!/^P0[1-8]$/u.test(item.id) || !Number.isFinite(item.latitude) || !Number.isFinite(item.longitude) || item.latitude < -85.051128 || item.latitude > 85.051128 || item.longitude < -179.98 || item.longitude > 179.98) throw new Error("Invalid demo point")
    safeLabel(item.label, 120)
    return { id: item.id, label: item.label, latitude: item.latitude, longitude: item.longitude }
  })
  if (points.length !== 8 || new Set(points.map((point) => point.id)).size !== 8 || new Set(points.map((point) => point.label)).size !== 8) throw new Error("Invalid demo points")
  const location = { schemaVersion: 1 as const, cityLabel: input.cityLabel, defaultCenter: { latitude: Number(center.latitude), longitude: Number(center.longitude), zoom: Number(center.zoom) }, points }
  if (![location.defaultCenter.latitude, location.defaultCenter.longitude, location.defaultCenter.zoom].every(Number.isFinite) || location.defaultCenter.latitude < -85.051128 || location.defaultCenter.latitude > 85.051128 || location.defaultCenter.longitude < -179.98 || location.defaultCenter.longitude > 179.98 || location.defaultCenter.zoom < 1 || location.defaultCenter.zoom > 18 || !Number.isInteger(location.defaultCenter.zoom)) throw new Error("Invalid demo center")
  for (const point of points) {
    const description = `DEMO — FICTIONAL: ${point.label}. No real flood condition is asserted.`
    if (description.length > 1000) throw new Error("Demo description is too long")
  }
  const distance = (left: Point, right: Point) => {
    const radians = Math.PI / 180
    const a = Math.sin((right.latitude - left.latitude) * radians / 2) ** 2 + Math.cos(left.latitude * radians) * Math.cos(right.latitude * radians) * Math.sin((right.longitude - left.longitude) * radians / 2) ** 2
    return 6371008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  for (let index = 0; index < points.length; index += 1) for (let next = index + 1; next < points.length; next += 1) if (distance(must(points[index]), must(points[next])) < 50) throw new Error("Demo points are too close")
  return location
}

const imageFor = async (reportNumber: number): Promise<Buffer> => {
  const id = `R${reportNumber}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#0F172A"/><text x="600" y="360" fill="white" text-anchor="middle" font-family="sans-serif" font-size="72" font-weight="bold">DEMO — FICTIONAL</text><text x="600" y="450" fill="white" text-anchor="middle" font-family="sans-serif" font-size="48">${id}</text></svg>`
  const original = await sharp(Buffer.from(svg)).jpeg({ quality: 85, chromaSubsampling: "4:2:0" }).toBuffer()
  return (await processImage({ bytes: original, clientMime: "image/jpeg", maxBytes: 10_485_760, maxPixels: 20_000_000 })).bytes
}

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")

export async function runDemoSeed(input: { config: DemoSeedConfig; locations: unknown; prisma: PrismaClient; storage: ImageStorage; now?: Date }): Promise<string> {
  const location = validateLocations(input.locations)
  const passwordFor = (name: string) => input.config[name as keyof DemoSeedConfig] as string
  const usersById = new Map<string, string>()
  const reportHashes = new Map<string, string>()
  for (const [id, name, email, role, passwordName] of users) {
    const existing = await input.prisma.user.findUnique({ where: { id } })
    const passwordHash = await argon2.hash(passwordFor(passwordName), { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1, hashLength: 32 })
    if (existing === null) await input.prisma.user.create({ data: { id, name, email, role, passwordHash, isActive: true, failedLoginAttempts: 0, createdAt, updatedAt: createdAt } })
    else if (existing.email !== email || existing.name !== name || existing.role !== role || !(await argon2.verify(existing.passwordHash, passwordFor(passwordName)))) throw new Error("Demo user collision")
    usersById.set(id, email)
  }
  for (const [id, pointNumber, category, severity, status, linked] of incidents) {
    const point = must(location.points[pointNumber - 1])
    const first = reportTime(must(reports[pointNumber - 1])[7])
    const existing = await input.prisma.incident.findUnique({ where: { id } })
    if (existing === null) await input.prisma.incident.create({ data: { id, category, severity, status, confidenceScore: null, latitude: point.latitude, longitude: point.longitude, firstReportedAt: first, lastReportedAt: first, createdAt: first, updatedAt: first } })
    else if (existing.category !== category || existing.severity !== severity || existing.status !== status) throw new Error("Demo incident collision")
    void linked
  }
  for (const [id, ownerNumber, pointNumber, category, severity, status, incidentId, submittedText] of reports) {
    const point = must(location.points[pointNumber - 1])
    const submittedAt = reportTime(submittedText)
    const steps = status === "RESOLVED" || status === "STALE" ? 2 : status === "SUBMITTED" ? 0 : 1
    const updatedAt = steps === 0 ? submittedAt : transition(pointNumber - 1, steps)
    const ownerId = must(users[ownerNumber - 1])[0]
    const existing = await input.prisma.floodReport.findUnique({ where: { id } })
    let imagePath = existing?.imagePath
    if (imagePath === undefined) {
      const processed = await imageFor(pointNumber)
      imagePath = (await input.storage.saveValidatedImage({ bytes: processed, extension: "jpg", serverTime: submittedAt })).key
      reportHashes.set(id, hash(processed))
    } else {
      reportHashes.set(id, hash((await input.storage.read(imagePath)).bytes))
    }
    const description = `DEMO — FICTIONAL: ${point.label}. No real flood condition is asserted.`
    if (existing === null) await input.prisma.floodReport.create({ data: { id, reporterId: ownerId, category, description, severityClaim: severity, latitude: point.latitude, longitude: point.longitude, gpsAccuracy: null, locationSource: "MANUAL", capturedAt: new Date(submittedAt.getTime() - 300_000), submittedAt, createdAt: submittedAt, updatedAt, imagePath, uploadSource: "WEB", verificationStatus: status, incidentId } })
    else if (existing.reporterId !== ownerId || existing.imagePath !== imagePath || existing.category !== category || existing.verificationStatus !== status) throw new Error("Demo report collision")
  }
  const auditRows = []
  for (const [index, report] of reports.entries()) {
    const [reportId, ownerNumber, , , , status, , submittedText] = report
    const createdId = `40000000-0000-4000-8000-00000000${String(index + 1).padStart(2, "0")}00`
    auditRows.push({ id: createdId, actorId: must(must(users[ownerNumber - 1])[0]), action: "REPORT_CREATED", entityId: reportId, metadata: { uploadSource: "WEB", verificationStatus: "SUBMITTED" }, createdAt: reportTime(submittedText) })
    const transitions = status === "RESOLVED" ? [["SUBMITTED", "VERIFIED"], ["VERIFIED", "RESOLVED"]] : status === "STALE" ? [["SUBMITTED", "PROVISIONAL"], ["PROVISIONAL", "STALE"]] : status === "SUBMITTED" ? [] : [["SUBMITTED", status]]
    for (const [step, transitionValues] of transitions.entries()) {
      const previousStatus = must(transitionValues[0])
      const newStatus = must(transitionValues[1])
      const metadata: Record<string, string> = { previousStatus, newStatus }
      const reason = newStatus === "DISPUTED" ? "DUPLICATE_REPORT" : newStatus === "RESOLVED" ? "ISSUE_RESOLVED" : newStatus === "STALE" ? "OUTDATED_INFORMATION" : newStatus === "REJECTED" ? "INSUFFICIENT_EVIDENCE" : ""
      if (reason) metadata.reasonCode = reason
      auditRows.push({ id: `40000000-0000-4000-8000-00000000${String(index + 1).padStart(2, "0")}${String(step + 1).padStart(2, "0")}`, actorId: must(must(users[2])[0]), action: "REPORT_STATUS_CHANGED", entityId: reportId, metadata, createdAt: transition(index, step + 1) })
    }
  }
  for (const audit of auditRows) {
    const existing = await input.prisma.auditLog.findUnique({ where: { id: audit.id } })
    if (existing === null) await input.prisma.auditLog.create({ data: { ...audit, entityType: "FLOOD_REPORT", ipAddress: "127.0.0.1" } })
    else if (existing.entityId !== audit.entityId || existing.action !== audit.action) throw new Error("Demo audit collision")
  }
  for (const [id] of reports) {
    if (!reportHashes.has(id)) reportHashes.set(id, hash((await input.storage.read((await input.prisma.floodReport.findUniqueOrThrow({ where: { id } })).imagePath)).bytes))
  }
  const manifest = { schemaVersion: 1, users: users.map(([id, , , role]) => ({ id, role })).sort((left, right) => left.id.localeCompare(right.id)), reports: reports.map(([id, , , , , verificationStatus]) => ({ id, verificationStatus, imageSha256: must(reportHashes.get(id)) })).sort((left, right) => left.id.localeCompare(right.id)), incidents: incidents.map(([id, , , , status, linked]) => ({ id, status, reportCount: linked.length })).sort((left, right) => left.id.localeCompare(right.id)), audits: auditRows.map(({ id, action, entityId }) => ({ id, action, entityId })).sort((left, right) => left.id.localeCompare(right.id)), incidentReportLinks: incidents.flatMap(([incidentId, , , , , linked]) => linked.map((number) => ({ incidentId, reportId: must(reports[number - 1])[0] }))).sort((left, right) => left.incidentId.localeCompare(right.incidentId) || left.reportId.localeCompare(right.reportId)) }
  void usersById
  return `${JSON.stringify(manifest)}\n`
}

const main = async (): Promise<void> => {
  const config = loadDemoSeedConfig()
  const args = parseDemoSeedArgs(process.argv.slice(2))
  const locations = await loadDemoLocations(resolve("prisma/demo-locations.json"))
  const { prisma } = await import("../src/database/prisma.js")
  const storage = new LocalImageStorage(resolve("./uploads"))
  const manifest = await runDemoSeed({ config, locations, prisma, storage })
  if (args.manifestJson) process.stdout.write(manifest)
  await prisma.$disconnect()
}

main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Demo seed failed"}\n`); process.exitCode = 1 })
