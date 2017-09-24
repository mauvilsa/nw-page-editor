#!/bin/bash

##
## @version $Version: 2017.09.24$
## @author Mauricio Villegas <mauricio_ville@yahoo.com>
## @copyright Copyright(c) 2016-present, Mauricio Villegas <mauricio_ville@yahoo.com>
## @license MIT License
##

set -u;
FN="${0##*/}";

DAEMON_BASE=$(pwd);
DAEMON_ID="git-daemon";
DAEMON_DIR="$DAEMON_BASE/$DAEMON_ID";

. "$DAEMON_BASE/run_parallel.inc.sh";

n=1;
while [ $n -le $# ]; do
  eval $(eval echo \${$n});
  n=$((n+1));
done

### Error function ###
throw_error () { [ "$1" != "" ] && echo "$FN: error: $1"; exit 1; };

### Check for existing daemons ###
if [ -s "$DAEMON_DIR/pid" ]; then
  PID=$(<"$DAEMON_DIR/pid");
  [ -e "/proc/$PID" ] &&
    throw_error "daemon with id=$DAEMON_ID exists and is currently running";
  OLD="$DAEMON_DIR"~$(ls -d "$DAEMON_DIR"~* 2>/dev/null | wc -l);
  echo "$FN: warning: moving old daemon files to $OLD";
  mv "$DAEMON_DIR" "$OLD";
fi

### Daemon function ###
gitCommitDaemon () {
  ### Listen for daemon termination command ###
  if [ "$1" = "exit" ]; then
    kill "$PID";
    return 0;
  fi

  ### Listen for push command ###
  if [ "$1" = "push" ]; then
    cd "$DAEMON_BASE"; cd ../data;
    git gc;
    git push;
    return "$?";
  fi

  ### Garbage collect every 10 commits ###
  [ "$(($2%10))" = "0" ] && git gc;

  ### Check input ###
  local UNAME=$(echo "$1" | awk -F: '{print $1}');
  local BRHASH=$(echo "$1" | awk -F: '{print $2}');
  local VERCLI=$(echo "$1" | awk -F: '{print $3}');
  local XML=$(echo "$1" | sed 's|^[^:]*:[^:]*:[^:]*:||');
  local BXML=$(echo "$XML" | sed 's|.*/||');
  local MSG="ok";
  local RC="1";

  [ "$UNAME" = "" ] &&
    MSG="error: uname empty" &&
    echo "$FN: $MSG" 1>&2 &&
    echo "$1 $RC $MSG" >> "$DAEMON_DIR/git-commit-done" &&
    return "$RC";
  [ "$XML" = "" ] &&
    MSG="error: xml path empty" &&
    echo "$FN: $MSG" 1>&2 &&
    echo "$1 $RC $MSG" >> "$DAEMON_DIR/git-commit-done" &&
    return "$RC";

  ### Commit page ###
  cd "$DAEMON_BASE"; cd $(echo "$XML" | sed 's|/[^/]*$||');
  git add "$BXML";
  STAT=$( git status --porcelain "$BXML" | awk '{print $1}' );
  [ "$STAT" != "M" ] && [ "$STAT" != "A" ] &&
    MSG="error: unexpected git state (status=$STAT): $XML" &&
    echo "$FN: $MSG" 1>&2 &&
    echo "$1 $RC $MSG" >> "$DAEMON_DIR/git-commit-done" &&
    return "$RC";
  local GIT_COMMIT=( git commit );
  [ $(git log -n 1 --pretty=format:%H) = $(git log -n 1 --pretty=format:%H "$BXML") ] &&
    [ "$(git log --format=%B -n 1)" = "autocommit by $UNAME ($BRHASH $VERCLI) file ${XML/..\/data\//}" ] &&
    [ $(git log origin/master..master | wc -l) -gt 0 ] &&
      GIT_COMMIT+=( --amend );
  GIT_COMMIT+=( "--author=$UNAME <$UNAME@nw-page-editor.org>" );
  "${GIT_COMMIT[@]}" -m "autocommit by $UNAME ($BRHASH $VERCLI) file ${XML/..\/data\//}" "$BXML";
  RC="$?";
  [ "$RC" != 0 ] &&
    MSG="error: problems committing (code=$RC): $XML" &&
    echo "$FN: $MSG" 1>&2;

  echo "$1 $RC $MSG" >> "$DAEMON_DIR/git-commit-done";
  return "$RC";
}

### Launch daemon ###
mkdir -p "$DAEMON_DIR";
> "$DAEMON_DIR/git-commit-done";
> "$DAEMON_DIR/git-commit-queue";
chmod g+w "$DAEMON_DIR/git-commit-queue";
mkfifo "$DAEMON_DIR/git-commit-queue.fifo";
tail --pid="$$" -f "$DAEMON_DIR/git-commit-queue" > "$DAEMON_DIR/git-commit-queue.fifo" &
PID="$!";
printf %s "$PID" > "$DAEMON_DIR/pid";
run_parallel -l - -p no -d "$DAEMON_DIR" gitCommitDaemon '{*}' '{#}' < "$DAEMON_DIR/git-commit-queue.fifo";

### Termination message ###
echo "$FN: daemon terminating";
exit 0;
