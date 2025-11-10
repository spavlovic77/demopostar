import { type NextRequest, NextResponse } from "next/server"
import { writeFile, unlink } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

function validateAndNormalizePEM(pemContent: string, type: string): string {
  // Normalize line endings to Unix format
  const normalized = pemContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  const cleaned = normalized
    .split("\n")
    .filter((line) => !line.startsWith("Bag Attributes") && !line.startsWith("subject=") && !line.startsWith("issuer="))
    .join("\n")

  let beginMarker: string
  let endMarker: string

  if (type === "certificate" || type === "ca") {
    beginMarker = "-----BEGIN CERTIFICATE-----"
    endMarker = "-----END CERTIFICATE-----"
  } else if (type === "key") {
    // Detect the actual key type from the content
    if (cleaned.includes("-----BEGIN RSA PRIVATE KEY-----")) {
      beginMarker = "-----BEGIN RSA PRIVATE KEY-----"
      endMarker = "-----END RSA PRIVATE KEY-----"
    } else if (cleaned.includes("-----BEGIN PRIVATE KEY-----")) {
      beginMarker = "-----BEGIN PRIVATE KEY-----"
      endMarker = "-----END PRIVATE KEY-----"
    } else if (cleaned.includes("-----BEGIN EC PRIVATE KEY-----")) {
      beginMarker = "-----BEGIN EC PRIVATE KEY-----"
      endMarker = "-----END EC PRIVATE KEY-----"
    } else if (cleaned.includes("-----BEGIN ENCRYPTED PRIVATE KEY-----")) {
      throw new Error("Encrypted private keys are not supported. Please use an unencrypted private key.")
    } else {
      throw new Error(`Invalid private key format: no recognized BEGIN marker found`)
    }
  } else {
    throw new Error(`Unknown PEM type: ${type}`)
  }

  if (!cleaned.includes(beginMarker)) {
    throw new Error(`Invalid ${type} PEM format: missing BEGIN marker`)
  }

  if (!cleaned.includes(endMarker)) {
    throw new Error(`Invalid ${type} PEM format: missing END marker`)
  }

  const beginIndex = cleaned.indexOf(beginMarker)
  const endIndex = cleaned.indexOf(endMarker) + endMarker.length
  const pemBlock = cleaned.substring(beginIndex, endIndex)

  if (type === "key") {
    const lines = pemBlock.split("\n")
    const header = lines[0]
    const footer = lines[lines.length - 1]

    // Extract base64 content between header and footer
    const base64Content = lines.slice(1, -1).join("").replace(/\s/g, "")

    // Rewrap to 64 characters per line
    const wrappedLines = [header]
    for (let i = 0; i < base64Content.length; i += 64) {
      wrappedLines.push(base64Content.substring(i, i + 64))
    }
    wrappedLines.push(footer)

    return wrappedLines.join("\n")
  }

  return pemBlock.trim()
}

async function readCertificateFile(pathOrData: string, type: string): Promise<string> {
  try {
    if (pathOrData.includes("-----BEGIN")) {
      // Already PEM format
      return validateAndNormalizePEM(pathOrData, type)
    }

    // Check if it looks like base64 (no slashes, relatively short strings are files, long ones are likely base64)
    if (!pathOrData.includes("/") && pathOrData.length > 100) {
      // Likely base64-encoded
      try {
        const decoded = Buffer.from(pathOrData, "base64").toString("utf-8")
        console.log(`[v0] ✅ Base64 certificate decoded for ${type}`)
        return validateAndNormalizePEM(decoded, type)
      } catch (decodeError) {
        throw new Error(
          `Failed to decode base64 ${type}: ${decodeError instanceof Error ? decodeError.message : "Unknown error"}`,
        )
      }
    }

    // Otherwise, treat as file path
    const { readFileSync } = await import("fs")
    const { resolve } = await import("path")
    const content = readFileSync(resolve(pathOrData), "utf-8")
    return validateAndNormalizePEM(content, type)
  } catch (error) {
    throw new Error(
      `Failed to read ${type} from ${pathOrData.substring(0, 50)}...: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

async function getTransactionIdFromExternalAPI(): Promise<string | null> {
  try {
    const certPath = process.env.KV_CERT_PATH
    const keyPath = process.env.KV_KEY_PATH
    const caPath = process.env.KV_CA_BUNDLE_PATH

    if (!certPath || !keyPath || !caPath) {
      throw new Error(
        "Certificate paths not configured. Please set KV_CERT_PATH, KV_KEY_PATH, and KV_CA_BUNDLE_PATH environment variables.",
      )
    }

    console.log("[v0] 🚀 Calling external API to generate transaction ID")

    let tempFiles: string[] = []
    const startTime = Date.now()

    try {
      // Read and validate certificates
      const clientCert = await readCertificateFile(certPath, "certificate")
      const clientKey = await readCertificateFile(keyPath, "key")
      const caCert = await readCertificateFile(caPath, "ca")

      console.log("[v0] ✅ All certificates validated and normalized")

      const tempDir = tmpdir()
      const clientCertPath = join(tempDir, "cert.pem")
      const clientKeyPath = join(tempDir, "key.pem")
      const caCertPath = join(tempDir, "ca.pem")
      tempFiles = [clientCertPath, clientKeyPath, caCertPath]

      await Promise.all([
        writeFile(clientCertPath, clientCert, { mode: 0o600 }),
        writeFile(clientKeyPath, clientKey, { mode: 0o600 }),
        writeFile(caCertPath, caCert, { mode: 0o600 }),
      ])

      console.log("[v0] ✅ Certificate files written with proper permissions")

      const apiBaseUrl = "https://api-erp.kverkom.sk"
      const curlCommand = `curl -s -S -i -X POST ${apiBaseUrl}/api/v1/generateNewTransactionId --cert "${clientCertPath}" --key "${clientKeyPath}" --cacert "${caCertPath}"`

      console.log(`[v0] 🔄 Executing curl command to ${apiBaseUrl}/api/v1/generateNewTransactionId`)
      const { stdout, stderr } = await execAsync(curlCommand, { timeout: 30000 })

      if (stderr) {
        console.log(`[v0] ⚠️ API call stderr: ${stderr}`)
        throw new Error(`Curl error: ${stderr}`)
      }

      let responseData
      let statusCode = 200

      try {
        // Split headers and body (separated by \r\n\r\n or \n\n)
        const parts = stdout.split(/\r?\n\r?\n/)

        // Extract status code from first line (e.g., "HTTP/1.1 200 OK")
        const headers = parts[0]
        const statusMatch = headers.match(/HTTP\/[\d.]+\s+(\d+)/)
        if (statusMatch) {
          statusCode = Number.parseInt(statusMatch[1])
        }

        // The rest is the body
        const body = parts.slice(1).join("\n\n").trim()

        if (body) {
          responseData = JSON.parse(body)
          console.log(`[v0] ✅ Transaction ID received: ${responseData.transaction_id}`)
        } else {
          throw new Error("Empty response body from API")
        }
      } catch (parseError) {
        console.log(`[v0] ❌ Failed to parse response:`, parseError)
        throw parseError
      }

      const duration = Date.now() - startTime
      console.log(
        `[v0] ✅ External API call completed in ${duration}ms - Transaction ID: ${responseData.transaction_id}`,
      )

      return responseData.transaction_id || null
    } finally {
      // Cleanup temporary files
      await Promise.allSettled(tempFiles.map((file) => unlink(file)))
    }
  } catch (error) {
    console.error("[v0] Error calling external API:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ServerAuthService } = await import("@/lib/auth-server")

    const user = await ServerAuthService.getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { amount } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    console.log("[v0] Generating payment link for user:", user.email, "amount:", amount)

    const transactionId = await getTransactionIdFromExternalAPI()

    if (!transactionId) {
      throw new Error("Failed to get transaction ID from external system")
    }

    console.log("[v0] Transaction ID received:", transactionId)

    return NextResponse.json({
      success: true,
      transactionId: transactionId,
      amount: amount,
      message: "Payment link generated successfully",
    })
  } catch (error) {
    console.error("[v0] Error generating payment link:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        success: false,
      },
      { status: 500 },
    )
  }
}
