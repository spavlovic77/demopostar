import type { NextRequest } from "next/server"
import mqtt from "mqtt"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { promisify } from "util"
import { exec } from "child_process"
import crypto from "crypto"

const execAsync = promisify(exec)

// Validate and normalize PEM format
function validateAndNormalizePEM(pemContent: string, preserveMetadata = false): string {
  // If we need to preserve metadata, return as-is
  if (preserveMetadata) {
    return pemContent
  }

  // Remove any metadata (Bag Attributes, subject, issuer)
  const lines = pemContent.split("\n")
  const cleanLines = lines.filter(
    (line) =>
      !line.trim().startsWith("Bag Attributes") &&
      !line.trim().startsWith("subject=") &&
      !line.trim().startsWith("issuer=") &&
      line.trim() !== "",
  )

  const cleanContent = cleanLines.join("\n")

  // Find the PEM block
  const beginMatch = cleanContent.match(/-----BEGIN [^-]+-----/)
  const endMatch = cleanContent.match(/-----END [^-]+-----/)

  if (!beginMatch || !endMatch) {
    throw new Error("Invalid PEM format: missing BEGIN or END markers")
  }

  const beginIndex = cleanContent.indexOf(beginMatch[0])
  const endIndex = cleanContent.indexOf(endMatch[0]) + endMatch[0].length

  return cleanContent.substring(beginIndex, endIndex)
}

// Read certificate file or decode base64
async function readCertificateFile(certData: string, preserveMetadata = false): Promise<string> {
  console.log("[v0] Reading certificate data...")

  // Check if it's already in PEM format (contains BEGIN/END markers)
  if (certData.includes("-----BEGIN") && certData.includes("-----END")) {
    console.log("[v0] Certificate is in PEM format")
    return validateAndNormalizePEM(certData, preserveMetadata)
  }

  // Check if it's base64 encoded using strict regex
  const base64Regex = /^[A-Za-z0-9+/=\s]+$/
  if (base64Regex.test(certData)) {
    try {
      console.log("[v0] Certificate appears to be base64 encoded, attempting to decode...")
      const decoded = Buffer.from(certData, "base64").toString("utf-8")

      // Verify the decoded content has PEM markers
      if (decoded.includes("-----BEGIN") && decoded.includes("-----END")) {
        console.log("[v0] Successfully decoded base64 certificate")
        return validateAndNormalizePEM(decoded, preserveMetadata)
      } else {
        console.log("[v0] Decoded content doesn't contain PEM markers, using as-is")
        return certData
      }
    } catch (error) {
      console.error("[v0] Failed to decode base64:", error)
      return certData
    }
  }

  // Return as-is
  console.log("[v0] Using certificate data as-is")
  return certData
}

function extractVATSKandPOKLADNICA(certPem: string): { vatsk: string | null; pokladnica: string | null } {
  try {
    console.log("[v0] Extracting VATSK and POKLADNICA from certificate using X509...")

    // Create X509Certificate object
    const cert = new crypto.X509Certificate(certPem)

    // Get the subject as a string
    const subject = cert.subject
    console.log("[v0] Certificate subject:", subject)

    // Extract VATSK from organizationIdentifier
    const orgIdMatch = subject.match(/organizationIdentifier=VATSK-(\d+)/)
    const vatsk = orgIdMatch ? orgIdMatch[1] : null

    // Extract POKLADNICA from CN field
    // CN format: VATSK-XXXXXXXXXX POKLADNICA YYYYYYYYYYYYYYY
    const cnMatch = subject.match(/CN=VATSK-\d+\s+POKLADNICA\s+(\d+)/)
    const pokladnica = cnMatch ? cnMatch[1] : null

    console.log("[v0] Extracted - VATSK:", vatsk, "POKLADNICA:", pokladnica)

    return { vatsk, pokladnica }
  } catch (error) {
    console.error("[v0] Error extracting VATSK/POKLADNICA from certificate:", error)
    return { vatsk: null, pokladnica: null }
  }
}

// Get MQTT notification by subscribing to a topic
async function subscribeMQTT(transactionId: string): Promise<any> {
  try {
    console.log("[v0] Starting MQTT subscription for transaction:", transactionId)

    // Read certificates from environment variables
    const certData = process.env.KV_CERT_PATH
    const keyData = process.env.KV_KEY_PATH
    const caData = process.env.KV_CA_BUNDLE_PATH

    if (!certData || !keyData || !caData) {
      throw new Error("Missing certificate environment variables")
    }

    console.log("[v0] Reading and validating certificates...")

    // Read and validate certificates
    const certPem = await readCertificateFile(certData)
    const keyPem = await readCertificateFile(keyData)
    const caPem = await readCertificateFile(caData)

    const { vatsk, pokladnica } = extractVATSKandPOKLADNICA(certPem)

    if (!vatsk || !pokladnica) {
      throw new Error("Could not extract VATSK or POKLADNICA from certificate")
    }

    // Create temporary files with shorter names
    const tmpDir = os.tmpdir()
    const certPath = path.join(tmpDir, "cert.pem")
    const keyPath = path.join(tmpDir, "key.pem")
    const caPath = path.join(tmpDir, "ca.pem")

    console.log("[v0] Writing temporary certificate files...")

    // Write certificates to temporary files
    await fs.writeFile(certPath, certPem, { mode: 0o600 })
    await fs.writeFile(keyPath, keyPem, { mode: 0o600 })
    await fs.writeFile(caPath, caPem, { mode: 0o600 })

    const mqttTopic = `VATSK-${vatsk}/POKLADNICA-${pokladnica}/${transactionId}`

    console.log("[v0] MQTT topic:", mqttTopic)
    console.log("[v0] Connecting to MQTT broker (test environment)...")

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log("[v0] MQTT subscription timed out after 120 seconds")
        client.end()
        cleanupFiles()
        resolve(null)
      }, 120000) // 120 seconds timeout

      const client = mqtt.connect("mqtts://mqtt.kverkom.sk:8883", {
        cert: certPem,
        key: keyPem,
        ca: [caPem],
        rejectUnauthorized: false,
        protocol: "mqtts",
        port: 8883,
      })

      const cleanupFiles = async () => {
        try {
          await fs.unlink(certPath)
          await fs.unlink(keyPath)
          await fs.unlink(caPath)
          console.log("[v0] Temporary certificate files deleted")
        } catch (cleanupError) {
          console.error("[v0] Error cleaning up temporary files:", cleanupError)
        }
      }

      client.on("connect", () => {
        console.log("[v0] Connected to MQTT broker")
        client.subscribe(mqttTopic, (err) => {
          if (err) {
            console.error("[v0] MQTT subscription error:", err)
            clearTimeout(timeout)
            client.end()
            cleanupFiles()
            reject(err)
          } else {
            console.log("[v0] Subscribed to topic:", mqttTopic)
          }
        })
      })

      client.on("message", (topic, message) => {
        console.log("[v0] MQTT message received on topic:", topic)
        console.log("[v0] Message payload:", message.toString())

        const topicParts = topic.split("/")
        let topicVatsk = null
        let topicPokladnica = null
        let endToEndId = null

        if (topicParts.length >= 3) {
          // Extract VATSK (remove "VATSK-" prefix)
          if (topicParts[0].startsWith("VATSK-")) {
            topicVatsk = topicParts[0].substring(6)
          }
          // Extract POKLADNICA (remove "POKLADNICA-" prefix)
          if (topicParts[1].startsWith("POKLADNICA-")) {
            topicPokladnica = topicParts[1].substring(11)
          }
          endToEndId = topicParts[2] // Keep full "QR-..." format
        }

        console.log("[v0] Parsed topic - VATSK:", topicVatsk, "POKLADNICA:", topicPokladnica, "EndToEndId:", endToEndId)

        clearTimeout(timeout)

        try {
          const payload = JSON.parse(message.toString())
          console.log("[v0] Parsed payload:", payload)
          client.end()
          cleanupFiles()
          resolve({
            ...payload,
            parsedTopic: {
              vatsk: topicVatsk,
              pokladnica: topicPokladnica,
              endToEndId,
            },
          })
        } catch (parseError) {
          console.log("[v0] Could not parse payload as JSON, returning raw")
          client.end()
          cleanupFiles()
          resolve({
            raw: message.toString(),
            parsedTopic: {
              vatsk: topicVatsk,
              pokladnica: topicPokladnica,
              endToEndId,
            },
          })
        }
      })

      client.on("error", (error) => {
        console.error("[v0] MQTT client error:", error)
        clearTimeout(timeout)
        client.end()
        cleanupFiles()
        reject(error)
      })
    })
  } catch (error) {
    console.error("[v0] MQTT subscription error:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactionId } = body

    if (!transactionId) {
      return Response.json({ error: "Transaction ID is required" }, { status: 400 })
    }

    console.log("[v0] Subscribing to MQTT for transaction:", transactionId)

    // Subscribe to MQTT and wait for notification
    const notification = await subscribeMQTT(transactionId)

    if (notification) {
      console.log("[v0] Payment notification received:", notification)
      return Response.json({
        success: true,
        notification,
      })
    } else {
      console.log("[v0] No payment notification received within timeout")
      return Response.json({
        success: false,
        message: "No payment notification received",
      })
    }
  } catch (error) {
    console.error("[v0] Payment notification error:", error)
    return Response.json(
      {
        error: "Failed to subscribe to payment notifications",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
