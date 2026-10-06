#!/bin/bash
set -euo pipefail

MOUNT="${HANGAR_DB_VOLUME:-/opt/hangar/data/databases}"
SUDO=""
[ "$(id -u)" -eq 0 ] || SUDO="sudo"

usage() {
  cat <<USAGE
usage: $0 <command>
  check                                 the volume is XFS and enforcing project quotas
  set <dir> <project-id> <hard> [soft] [--owner UID:GID]
                                        create <dir>, put it in the project and limit it (sizes like 512m, 5g)
  usage <project-id>                    print: used soft hard (in KiB)
  clear <dir> <project-id>              remove the limit and the project from <dir>
  purge <dir> <project-id>              clear, then delete <dir> and everything in it
USAGE
  exit 1
}

fail() { echo "❌ $*" >&2; exit 1; }

valid_id()   { [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 100 ] || fail "project id must be a number of at least 100"; }
valid_size() { [[ "$1" =~ ^[0-9]+[kKmMgGtT]$ ]] || fail "size must look like 512m or 5g"; }
under_mount() {
  local resolved
  resolved="$(realpath -m "$1")"
  [[ "$resolved" == "$MOUNT"/* ]] || fail "$1 is not under $MOUNT"
}

cmd="${1:-}"; [ -n "$cmd" ] || usage; shift || true

case "$cmd" in
  check)
    [ "$(findmnt -no FSTYPE "$MOUNT" 2>/dev/null)" = "xfs" ] || fail "$MOUNT is not an XFS mount"
    $SUDO xfs_quota -x -c 'state -p' "$MOUNT" | grep -q 'Enforcement: ON' || fail "project quotas are not enforced on $MOUNT"
    echo "✅ $MOUNT enforces project quotas"
    ;;
  set)
    [ $# -ge 3 ] || usage
    dir="$1"; id="$2"; hard="$3"; shift 3
    soft="$hard"; owner=""
    if [ $# -gt 0 ] && [ "$1" != "--owner" ]; then soft="$1"; shift; fi
    if [ $# -gt 0 ]; then
      [ "$1" = "--owner" ] && [ $# -eq 2 ] || usage
      [[ "$2" =~ ^[0-9]+:[0-9]+$ ]] || fail "owner must look like 70:70"
      owner="$2"
    fi
    valid_id "$id"; valid_size "$hard"; valid_size "$soft"; under_mount "$dir"
    $SUDO mkdir -p "$dir"
    [ -z "$owner" ] || $SUDO chown "$owner" "$dir"
    $SUDO xfs_quota -x -c "project -s -p $dir $id" "$MOUNT" > /dev/null
    $SUDO xfs_quota -x -c "limit -p bsoft=$soft bhard=$hard $id" "$MOUNT"
    echo "✅ $dir limited to $hard (project $id)"
    ;;
  usage)
    [ $# -eq 1 ] || usage
    valid_id "$1"
    $SUDO xfs_quota -x -c "quota -p -b -N $1" "$MOUNT" | awk 'NR==1 {print $2, $3, $4}'
    ;;
  clear)
    [ $# -eq 2 ] || usage
    dir="$1"; id="$2"
    valid_id "$id"; under_mount "$dir"
    $SUDO xfs_quota -x -c "limit -p bsoft=0 bhard=0 $id" "$MOUNT"
    $SUDO xfs_quota -x -c "project -C -p $dir $id" "$MOUNT" > /dev/null
    echo "✅ $dir no longer limited"
    ;;
  purge)
    [ $# -eq 2 ] || usage
    dir="$1"; id="$2"
    valid_id "$id"; under_mount "$dir"
    [ "$(realpath -m "$dir")" != "$MOUNT" ] || fail "refusing to purge the whole volume"
    $SUDO xfs_quota -x -c "limit -p bsoft=0 bhard=0 $id" "$MOUNT"
    $SUDO rm -rf --one-file-system "$dir"
    echo "✅ $dir removed"
    ;;
  *) usage ;;
esac
