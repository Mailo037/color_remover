import { execFile, execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const runGit = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

const getGitValue = (args, fallback = '') => {
  try {
    return runGit(args)
  } catch {
    return fallback
  }
}

const localCommitHash = getGitValue(['rev-parse', 'HEAD'])
const localBranch = getGitValue(['rev-parse', '--abbrev-ref', 'HEAD'], 'master')

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const isLocalOrigin = (origin) => {
  if (!origin) return true
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

const getRemoteInfo = () => {
  const branch = getGitValue(['rev-parse', '--abbrev-ref', 'HEAD'], localBranch)
  const remote = getGitValue(['config', '--get', `branch.${branch}.remote`], 'origin') || 'origin'
  const mergeRef = getGitValue(['config', '--get', `branch.${branch}.merge`], `refs/heads/${branch}`) || `refs/heads/${branch}`
  const localHash = getGitValue(['rev-parse', 'HEAD'])
  const remoteRows = getGitValue(['ls-remote', remote, mergeRef])
  const remoteHash = remoteRows.split(/\s+/)[0] || ''
  const repoUrl = getGitValue(['config', '--get', `remote.${remote}.url`], '')

  return {
    branch,
    remote,
    mergeRef,
    repoUrl,
    localHash,
    localShortHash: localHash.slice(0, 7),
    remoteHash,
    remoteShortHash: remoteHash.slice(0, 7),
    updateAvailable: Boolean(localHash && remoteHash && localHash !== remoteHash),
    canPull: true,
  }
}

const createLocalUpdaterPlugin = () => {
  const register = (middlewares) => {
    middlewares.use('/__color_remover_version', (req, res) => {
      if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'Method not allowed' })
        return
      }

      if (!isLocalOrigin(req.headers.origin)) {
        sendJson(res, 403, { ok: false, error: 'Forbidden origin' })
        return
      }

      try {
        sendJson(res, 200, { ok: true, ...getRemoteInfo() })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error.message || 'Unable to check version' })
      }
    })

    middlewares.use('/__color_remover_update', (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'Method not allowed' })
        return
      }

      if (!isLocalOrigin(req.headers.origin)) {
        sendJson(res, 403, { ok: false, error: 'Forbidden origin' })
        return
      }

      const before = getGitValue(['rev-parse', 'HEAD'])
      execFile('git', ['pull', '--ff-only'], { encoding: 'utf8' }, (error, stdout, stderr) => {
        const after = getGitValue(['rev-parse', 'HEAD'])

        if (error) {
          sendJson(res, 500, {
            ok: false,
            before,
            after,
            error: (stderr || stdout || error.message || 'Unable to pull update').trim(),
          })
          return
        }

        sendJson(res, 200, {
          ok: true,
          before,
          after,
          pulled: before !== after,
          message: (stdout || 'Already up to date.').trim(),
        })
      })
    })
  }

  return {
    name: 'color-remover-local-updater',
    configureServer(server) {
      register(server.middlewares)
    },
    configurePreviewServer(server) {
      register(server.middlewares)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), createLocalUpdaterPlugin()],
  define: {
    'import.meta.env.VITE_APP_COMMIT_HASH': JSON.stringify(localCommitHash),
    'import.meta.env.VITE_APP_BRANCH': JSON.stringify(localBranch),
  },
  server: {
    port: 5175,
    strictPort: true,
  },
  preview: {
    port: 5175,
    strictPort: true,
  },
})
