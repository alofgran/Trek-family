# TREK — Claude Code Context

## Self-Hosting Workflow (Portainer on a separate machine)

The production instance runs via Portainer on a separate machine. To deploy changes:

### 1. Make changes
Edit source in this repo (`/mnt/dev/TREK/`).

### 2. Build image
```bash
cd /mnt/dev/TREK
docker build -t yourdockerhubuser/trek:latest .
```

### 3. Push to registry
```bash
docker push yourdockerhubuser/trek:latest
```

Registry options (pick one):
- **Docker Hub** — simplest; `docker login` required; free for public images
- **GitHub Container Registry** — `ghcr.io/yourusername/trek`; free private repos
- **Portainer local registry** — fully self-contained, no external dependency

### 4. Update Portainer
On the Portainer machine, update the stack/container image from `mauriceboe/trek:dev` to `yourdockerhubuser/trek:latest`, then redeploy.

### docker-compose.yml change
```yaml
image: yourdockerhubuser/trek:latest  # was: mauriceboe/trek:dev
```

### Data persistence
Portainer mounts keep data across redeploys — do not mount a volume at `/app`:
```yaml
volumes:
  - ./data:/app/data
  - ./uploads:/app/uploads
```
