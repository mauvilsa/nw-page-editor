#!/bin/bash

##
## A simple and versatile bash function for parallelizing the execution of
## commands or other bash functions.
##
## @version $Version: 2016-09-27$
## @author Mauricio Villegas <mauricio_ville@yahoo.com>
## @link https://github.com/mauvilsa/run_parallel
## @license MIT License
##

##
## The MIT License (MIT)
##
## Copyright (c) 2014-present, Mauricio Villegas <mauricio_ville@yahoo.com>
##
## Permission is hereby granted, free of charge, to any person obtaining a copy
## of this software and associated documentation files (the "Software"), to deal
## in the Software without restriction, including without limitation the rights
## to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
## copies of the Software, and to permit persons to whom the Software is
## furnished to do so, subject to the following conditions:
##
## The above copyright notice and this permission notice shall be included in all
## copies or substantial portions of the Software.
##
## THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
## IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
## FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
## AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
## LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
## OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
## SOFTWARE.
##

[ "${BASH_SOURCE[0]}" = "$0" ] &&
  echo "run_parallel.inc.sh: error: script intended for sourcing, try: . run_parallel.inc.sh" &&
  exit 1;

### A fuction for sorting (by thread) the output of run_parallel ###
run_parallel_output_sort () {
  local FN="run_parallel_output_sort";
  local SRT="g";
  local SED='s|^[0-9][0-9]* ||;';

  ### Parse input arguments ###
  while [ $# -gt 0 ]; do
    case "$1" in
      -s ) SRT="$2"; shift 2; ;;
      -f ) SED+=" s|^[^\t][^\t]*\t||;"; shift; ;;
      * )
        echo "Description: Sorts by thread the output from run_parallel using the prepended IDs.";
        echo "Usage: $FN [OPTIONS] < RUN_PARALLEL_OUTPUT";
        echo "Options:";
        echo " -s SRT   OPTS part of KEYDEF given to the sort command (def.=$SRT)";
        echo " -f       Whether to filter the prepended IDs (def.=false)";
        return 1;
        ;;
    esac
  done

  awk '{ count[$1]++;
         printf( "%d %s\n", count[$1], $0 );
       }' \
    | sort -k "2${SRT},2" -k 1n,1 \
    | sed "$SED";
}

### The fuction for parallel execution ###
run_parallel () {(
  local _rp_FN="run_parallel";
  local _rp_THREADS="1";
  local _rp_LIST="";
  local _rp_NUMELEM="1";
  local _rp_KEEPTMP="no";
  local _rp_PREPEND="yes";
  local _rp_OUTATEND="no";
  local _rp_TMP="";

  local _rp_FILT_USAGE='s|^[*#] *||;s|\\\*|*|;s| \*| |g;s|\*\([, ]\)|\1|g;s|\\--|--|;';
  run_parallel_usage () {
    echo "
# NAME

run_parallel - Simple bash function for parallelizing.

# SYNOPSIS

run_parallel [OPTION]... *COMMAND* [ARG]... ('{@}'|'{\*}'|'{<}')... '{#}'... '{%}'...  
run_parallel_output_sort [OPTION]... < *RUN_PARALLEL_OUTPUT*

# DESCRIPTION

run_parallel is a simple and versatile bash function for parallelizing the
execution of commands or other bash functions. The main features that
differentiates it from other popular tools for parallelizing are:

- Bash functions can be parallelized without need to export them.
- A single output for stdout and stdin that are prepended with the thread
  name. They can be sorted later (unlike xargs) per thread using
  _run_parallel_output_sort_ .
- A license which does not require to cite a paper if used for research
  (unlike GNU parallel).

In the command arguments, '{#}' is replaced by the command instance number (1,
2, ...) and '{%}' is replaced by the thread ID (see options). The thread ID is
prepended to every line of stderr and stdout. If a list to process is given,
there are four possibilities to supply the list of elements to the command: 1)
if an argument is '{\*}', elements are given as arguments in that position, 2)
if an argument contains '{@}', elements are given in a file and '{@}' is
replaced by the file path, 3) if an argument is '{<}', elements are given
through a named pipe and '{<}' is replaced by the pipe, and 4) if no special
argument is provided the elements are given through stdin. Other replacements
only when processing one element at a time are: '{.}' element without
extension, '{/}' element without path, '{//}' only path of element, and '{/.}'
element without either path or extension.

# ENVIRONMENT VARIABLES

*TMPDIR*  --  Directory for temporal files, must exist (def.=/tmp)  
*TMPRND*  --  ID for unique temporal files (def.=rand)

# OPTIONS

-T *THREADS*, \--threads *THREADS*  
  Concurrent threads: either an int>0, list id1,id2,... or range
  #ini:[#inc:]#end (def.=$_rp_THREADS)

-l *LIST*, \--list *LIST*  
  List of elements to process: either a file (- is stdin), list el1,el2,... or
  range #ini:[#inc:]#end (def.=none)

-n *NUMELEM*, \--num *NUMELEM*  
  Elements per instance: either an int>0, 'split' or 'balance'
  (def.=$_rp_NUMELEM)

-p *(yes|no)*, \--prepend *(yes|no)*  
  Whether to prepend IDs to outputs (def.=$_rp_PREPEND)

-e *(yes|no)*, \--outatend *(yes|no)*  
  Whether stderr and stdout are printed at the end of execution
  (def.=$_rp_OUTATEND)

-k *(yes|no)*, \--keeptmp *(yes|no)*  
  Whether to keep temporal files (def.=$_rp_KEEPTMP)

-d *TMPDIR*, \--tmpdir *TMPDIR*  
  Use given directory for temporal files, also sets -k yes (def.=false)

-v, \--version  
  Print script version and exit

-h, \--help  
  Print help and exit

# DUMMY EXAMPLES

    myfunc () {  
      sleep \$((RANDOM%3));  
      NUM=\$( wc -w < \$2 );  
      ITEMS=\$( echo \$( < \$2 ) );  
      echo \"\$1: processed \$NUM items (\$ITEMS)\";  
    }

    seq 1 100 | $_rp_FN -T 3 -n balance -l - myfunc 'Thread {%} instance {#}' '{@}'  
    seq 1 100 | $_rp_FN -T A,B,C,D -n 7 -l - myfunc 'Thread {%} instance {#}' '{@}'  
    seq 1 100 | $_rp_FN -T A,B,C -n 7 -l - myfunc 'Thread {%} instance {#}' '{@}' | run_parallel_output_sort -f -s rd

    myfunc () { echo \"Processing file \$1\"; }

    $_rp_FN -T 5 myfunc 'input_{%}.txt'  
    $_rp_FN -T 2:3:9 myfunc 'input_{%}.txt'
";
  }

  if [ $# -lt 1 ]; then
    echo "$_rp_FN: Error: Not enough input arguments";
    run_parallel_usage | sed "$_rp_FILT_USAGE";
    return 1;
  fi

  ### Parse input arguments ###
  while [ $# -gt 0 ]; do
    [ "${1:0:1}" != "-" ] && break;
    case "$1" in
      -T | --threads )  _rp_THREADS="$2";  ;;
      -l | --list )     _rp_LIST="$2";     ;;
      -n | --num )      _rp_NUMELEM="$2";  ;;
      -k | --keeptmp )  _rp_KEEPTMP="$2";  ;;
      -p | --prepend )  _rp_PREPEND="$2";  ;;
      -e | --outatend ) _rp_OUTATEND="$2"; ;;
      -d | --tmpdir )   _rp_TMP="$2";      ;;
      -v | --version )  echo "$Version: 2016-09-27$" | sed 's|.* ||; s|\$$||;'; return 0; ;;
      -h | --help )     run_parallel_usage | sed "$_rp_FILT_USAGE"; return 0; ;;
      --markdown )      run_parallel_usage; return 0; ;;
      * )
        echo "$_rp_FN: error: unexpected input argument: $1" 1>&2;
        return 1;
        ;;
    esac
    shift 2;
  done

  if [ "$_rp_THREADS" = "" ]; then
    _rp_THREADS=( $(seq 1 $(nproc)) );
  elif [[ "$_rp_THREADS" == *,* ]]; then
    _rp_THREADS=( ${_rp_THREADS//,/ } );
  elif [[ "$_rp_THREADS" == *:* ]]; then
    _rp_THREADS=( $(seq ${_rp_THREADS//:/ }) );
  else
    _rp_THREADS=( $(seq 1 $_rp_THREADS) );
  fi
  local _rp_NTHREADS=${#_rp_THREADS[@]};
  local _rp_TOTP="$_rp_NTHREADS";
  [ "$_rp_NTHREADS" -le 0 ] &&
    echo "$_rp_FN: error: unexpected number of threads" 1>&2 &&
    return 1;

  ### Create temporal directory ###
  if [ "$_rp_TMP" != "" ]; then
    _rp_KEEPTMP="yes";
  else
    _rp_TMP="${TMPDIR:-/tmp}";
    local _rp_RND="${TMPRND:-}";
    if [ "$_rp_RND" = "" ]; then
      _rp_TMP=$(mktemp -d --tmpdir="$_rp_TMP" ${_rp_FN}_XXXXX);
    else
      _rp_TMP="$_rp_TMP/${_rp_FN}_$_rp_RND";
      mkdir "$_rp_TMP";
    fi
  fi
  [ ! -d "$_rp_TMP" ] &&
    echo "$_rp_FN: error: failed to write to temporal directory: $_rp_TMP" 1>&2 &&
    return 1;
  local _rp_FSTYPE=$( df -PT "$_rp_TMP" | sed -n '2{ s|^[^ ]* *||; s| .*||; p; }' );
  ( [ "$_rp_FSTYPE" = "nfs" ] ||
    [ "$_rp_FSTYPE" = "lustre" ] ||
    [[ "$_rp_FSTYPE" == *sshfs* ]] ) &&
    echo "$_rp_FN: error: temporal directory should be on a local file system: $_rp_TMP -> $_rp_FSTYPE" 1>&2 &&
    return 1;

  ### Prepare command ###
  local _rp_PROTO=("$@");
  local _rp_ARGPOS="0";
  local _rp_PIPEPOS="0";
  local _rp_FILEPOS="0";
  local _rp_OTHERARG="0";
  local _rp_n;
  for _rp_n in $(seq 1 $(($#-1))); do
    if [ "${_rp_PROTO[_rp_n]}" = "{*}" ]; then
      [ "$_rp_LIST" != "" ] && _rp_ARGPOS=$_rp_n;
    elif [ "${_rp_PROTO[_rp_n]}" = "{<}" ]; then
      [ "$_rp_LIST" != "" ] && _rp_PIPEPOS=$_rp_n;
    elif [[ "${_rp_PROTO[_rp_n]}" = *"{@}"* ]]; then
      [ "$_rp_LIST" != "" ] && _rp_FILEPOS=$_rp_n;
    elif [[ "${_rp_PROTO[_rp_n]}" = *"{*}"* ]] ||
         [[ "${_rp_PROTO[_rp_n]}" = *"{.}"* ]] ||
         [[ "${_rp_PROTO[_rp_n]}" = *"{/}"* ]] ||
         [[ "${_rp_PROTO[_rp_n]}" = *"{//}"* ]] ||
         [[ "${_rp_PROTO[_rp_n]}" = *"{/.}"* ]]; then
      [ "$_rp_LIST" != "" ] && _rp_OTHERARG=$_rp_n;
    # Testing /dev/fd/ due to pipe check bug in CentOS bash 4.1.2(1)-release
    elif [ -p "${_rp_PROTO[_rp_n]}" ] ||
         [ $(echo "${_rp_PROTO[_rp_n]}" | grep -c '^/dev/fd/') != 0 ]; then
      local _rp_p=$(ls "$_rp_TMP/pipe"* 2>/dev/null | wc -l);
      cat "${_rp_PROTO[_rp_n]}" > "$_rp_TMP/pipe$_rp_p";
      _rp_PROTO[_rp_n]="$_rp_TMP/pipe$_rp_p";
    fi
  done
  echo "${_rp_PROTO[@]}" > "$_rp_TMP/state";

  ### Prepare list ###
  local _rp_LISTFD="";
  local _rp_NLIST="";
  if [ "$_rp_LIST" != "" ]; then
    _rp_TOTP="-1";
    [ "$_rp_LIST" = "-" ] && _rp_LIST="/dev/stdin";
    if [ -e "$_rp_LIST" ]; then
      exec {_rp_LISTFD}< "$_rp_LIST";
    elif [[ "$_rp_LIST" = *,* ]]; then
      exec {_rp_LISTFD}< <( echo "$_rp_LIST" | tr ',' '\n' );
    elif [[ "$_rp_LIST" = *:* ]]; then
      exec {_rp_LISTFD}< <( seq ${_rp_LIST//:/ } );
    else
      echo "$_rp_FN: error: unexpected list format or file not found: $_rp_LIST" 1>&2;
      [ "$_rp_KEEPTMP" != "yes" ] && rm -r "$_rp_TMP";
      return 1;
    fi

    if [ "$_rp_NUMELEM" = "balance" ] || [ "$_rp_NUMELEM" = "split" ]; then
      _rp_NLIST=$( tee "$_rp_TMP/list" <&$_rp_LISTFD | wc -l );
      exec {_rp_LISTFD}>&-;
      exec {_rp_LISTFD}< "$_rp_TMP/list";

      [ "$_rp_NUMELEM" = "balance" ] &&
      _rp_NLIST=( $( awk -v fact0=0.5 -v NTHREADS="$_rp_NTHREADS" -v NLIST="$_rp_NLIST" '
        BEGIN {
          if ( NTHREADS == 1 )
            printf( " %d", NLIST );
          else if( NLIST <= 2*NTHREADS )
            for ( n=1; n<=NLIST; n++ )
              printf( " 1" );
          else {
            fact = fact0;
            limit_list = fact*NLIST/NTHREADS;
            limit_level = fact*NLIST;
            nlist = 0;
            for ( n=1; n<=NLIST; n++ ) {
              nlist++;
              if( n >= limit_level || n >= limit_list ) {
                printf( " %d", nlist );
                nlist = 0;
                if( n >= limit_level ) {
                  fact *= fact0;
                  limit_list = limit_level + fact*NLIST/NTHREADS;
                  limit_level += fact*NLIST;
                }
                else
                  limit_list += fact*NLIST/NTHREADS;
              }
            }
            if( nlist > 0 )
              printf( " %d", nlist );
          }
        }' ) );

      [ "$_rp_NUMELEM" = "split" ] &&
      _rp_NLIST=( $( awk -v NTHREADS="$_rp_NTHREADS" -v NLIST="$_rp_NLIST" '
        BEGIN {
          if ( NTHREADS == 1 )
            printf( " %d", NLIST );
          else if( NLIST <= NTHREADS )
            for ( n=1; n<=NLIST; n++ )
              printf( " 1" );
          else {
            fact0 = NLIST/NTHREADS;
            accu = fact0;
            nxt = sprintf("%.0f",accu);
            prev = 0;
            for ( n=1; n<=NLIST; n++ )
              if( n == nxt ) {
                printf( " %d", n-prev );
                prev = n;
                accu += fact0;
                nxt = sprintf( "%.0f", accu );
              }
            if( NLIST > prev )
              printf( " %d", n-prev );
          }
        }' ) );

    elif [[ ! "$_rp_NUMELEM" =~ ^[0-9]+$ ]]; then
      echo "$_rp_FN: error: unexpected number of elements: $_rp_NUMELEM" 1>&2;
      [ "$_rp_KEEPTMP" != "yes" ] && rm -r "$_rp_TMP";
      return 1;
    fi
  fi

  ### Outputs for each thread ###
  local _rp_THREAD;
  for _rp_THREAD in "${_rp_THREADS[@]}"; do
    #mkfifo "$_rp_TMP/out_$_rp_THREAD" "$_rp_TMP/err_$_rp_THREAD"; # for many threads hangs in >> "$_rp_TMP/out_$_rp_THREAD"; why?
    > "$_rp_TMP/out_$_rp_THREAD"; > "$_rp_TMP/err_$_rp_THREAD";
  done

  ### Join threads stdout and stderr prepending IDs to each line ###
  if [ "$_rp_OUTATEND" != "yes" ]; then
    if [ "$_rp_PREPEND" = "yes" ]; then
      _rp_PREPEND='printf("%s\t%s\n",T,LINE[T]);';
    else
      _rp_PREPEND='print(LINE[T]);';
    fi
    local _rp_PROC_OUTPUT='
      function print_line( T ) {
        if( T in LINE ) {
          '"$_rp_PREPEND"'
          delete LINE[T];
        }
      }
      { if( match($0,/^::'"$_rp_FN"'::$/) ) {
          EXIT++;
          if( EXIT == NTHREADS ) {
            for( THREAD in LINE )
              if( LINE[THREAD] != "" )
                print_line(THREAD);
            exit;
          }
          cmd="grep -hc ::'"$_rp_FN"':: '"$_rp_TMP"'/"F"_* | paste -s -d+ | bc" | getline num;
          if( num == NTHREADS ) {
            printf("'"$_rp_FN"': warning: probable truncated std%s\n",F) >> "/dev/stderr";
            exit;
          }
        }
        else if( match($0,/^==> .+\/[oe][ur][tr]_.+ <==$/) ) {
          THREAD = $(NF-1);
          sub(/.+\/[oe][ur][tr]_/,"",THREAD);
          delete INIT[THREAD];
        }
        else {
          if( THREAD in INIT )
            print_line(THREAD);
          LINE[THREAD] = ( LINE[THREAD] $0 );
          INIT[THREAD] = "";
        }
      }';

    mkfifo "$_rp_TMP/out" "$_rp_TMP/err";
    local _rp_PROCPID;
    awk -v NTHREADS="$_rp_NTHREADS" -v F=out "$_rp_PROC_OUTPUT" < "$_rp_TMP/out"      & _rp_PROCPID[0]="$!";
    #tail --pid=${_rp_PROCPID[0]} -f "$_rp_TMP"/out_* | tee "$_rp_TMP/tail_out" > "$_rp_TMP/out" &
    tail --pid=${_rp_PROCPID[0]} -f "$_rp_TMP"/out_* > "$_rp_TMP/out" &
    awk -v NTHREADS="$_rp_NTHREADS" -v F=err "$_rp_PROC_OUTPUT" < "$_rp_TMP/err" 1>&2 & _rp_PROCPID[1]="$!";
    #tail --pid=${_rp_PROCPID[1]} -f "$_rp_TMP"/err_* | tee "$_rp_TMP/tail_err" > "$_rp_TMP/err" &
    tail --pid=${_rp_PROCPID[1]} -f "$_rp_TMP"/err_* > "$_rp_TMP/err" &
    #for _rp_THREAD in "${_rp_THREADS[@]}"; do
    #  >> "$_rp_TMP/out_$_rp_THREAD";
    #  >> "$_rp_TMP/err_$_rp_THREAD";
    #done
  fi

  local _rp_ENDFD;
  exec {_rp_ENDFD}< <( { tail -f "$_rp_TMP/state" & echo "endcheckpid $!" >> "$_rp_TMP/state"; } | grep --line-buffered ' ended$' );

  ### Cleanup function ###
  _rp_trap () {
    local _rp_trap_func="$1";
    local _rp_sig;
    shift;
    for _rp_sig in "$@"; do
      trap "$_rp_trap_func $_rp_sig" "$_rp_sig";
    done
  }
  _rp_trap _rp_cleanup INT;
  _rp_cleanup () {
    if [ "$_rp_OUTATEND" = "yes" ]; then
      for _rp_THREAD in "${_rp_THREADS[@]}"; do
        if [ "$_rp_PREPEND" = "yes" ]; then
          sed "s|^|${_rp_THREAD}\t|" "$_rp_TMP/out_$_rp_THREAD";
          sed "s|^|${_rp_THREAD}\t|" "$_rp_TMP/err_$_rp_THREAD" 1>&2;
        else
          cat "$_rp_TMP/out_$_rp_THREAD";
          cat "$_rp_TMP/err_$_rp_THREAD" 1>&2;
        fi
      done
    else
      for _rp_THREAD in "${_rp_THREADS[@]}"; do
        sleep 0.01;
        echo "::$_rp_FN::" >> "$_rp_TMP/out_$_rp_THREAD";
        echo "::$_rp_FN::" >> "$_rp_TMP/err_$_rp_THREAD";
      done
      local _rp_SLEEP="0.01";
      for _rp_n in $(seq 0 8); do
        ( ! ( ps -p "${_rp_PROCPID[0]}" || ps -p "${_rp_PROCPID[1]}" ) >/dev/null ) && break;
        sleep "$_rp_SLEEP";
        _rp_SLEEP=$(echo "$_rp_SLEEP+$_rp_SLEEP" | bc -l);
      done
      ( ps -p "${_rp_PROCPID[0]}" || ps -p "${_rp_PROCPID[1]}" ) >/dev/null && 
        kill ${_rp_PROCPID[@]} 2>/dev/null;
    fi
    _rp_NTHREADS=$(grep -c '^THREAD:.* failed$' "$_rp_TMP/state");
    [ "$_rp_NTHREADS" != 0 ] && grep '^THREAD:.* failed$' "$_rp_TMP/state" 1>&2;
    [ "$_rp_LISTFD" != "" ] && exec {_rp_LISTFD}>&-;
    kill $(sed -n '/^endcheckpid /{ s|.* ||; p; }' "$_rp_TMP/state");
    exec {_rp_ENDFD}>&-;
    if [ "$_rp_KEEPTMP" != "yes" ] && [ "$_rp_NTHREADS" = 0 ]; then
      rm -r "$_rp_TMP";
    else
      echo "$_rp_FN: warning: keeping temporal directory $_rp_TMP" 1>&2;
    fi
    [ "$#" -gt 0 ] && [ "$_rp_NTHREADS" = 0 ] && _rp_NTHREADS="1";
    _rp_cleanup () { return "$_rp_NTHREADS"; };
  }

  ### Function to read elements from the list ###
  _rp_readlist () {
    local _rp_NUM="$_rp_NUMELEM";
    if [ "$_rp_NUM" = "balance" ] || [ "$_rp_NUM" = "split" ]; then
      [ "$_rp_NUMP" -gt "${#_rp_NLIST[@]}" ] &&
        echo "listdone" >> "$_rp_TMP/state" &&
        return 0;
      _rp_NUM="${_rp_NLIST[$((_rp_NUMP-1))]}";
    fi
    for _rp_n in $(seq 1 $_rp_NUM); do
      local _rp_line;
      IFS= read -r -u$_rp_LISTFD _rp_line;
      [ "$?" != 0 ] &&
        echo "listdone" >> "$_rp_TMP/state" &&
        break;
      _rp_LISTP+=( "$_rp_line" );
    done
  }

  ### Function for threads ###
  _rp_runcmd () {
    local _rp_LISTP=();
    local _rp_THREAD="$1";
    local _rp_NUMP="$2";
    local _rp_CMD=("${_rp_PROTO[@]//\{\%\}/$_rp_THREAD}");
    _rp_CMD=("${_rp_CMD[@]//\{\#\}/$_rp_NUMP}");

    if [ "$_rp_LIST" != "" ]; then
      _rp_readlist;
      [ "${#_rp_LISTP[@]}" = 0 ] && return 0;
      if [ "$_rp_NUMELEM" = 1 ]; then
        _rp_CMD=("${_rp_CMD[@]//\{\*\}/$_rp_LISTP}"); # {*} whole element
        local _rp_MLISTP=$(echo "$_rp_LISTP" | sed 's|\.[^./]*$||');
        _rp_CMD=("${_rp_CMD[@]//\{\.\}/$_rp_MLISTP}"); # {.} no extension
        _rp_MLISTP=$(echo "$_rp_LISTP" | sed 's|.*/||');
        _rp_CMD=("${_rp_CMD[@]//\{\/\}/$_rp_MLISTP}"); # {/} no dir
        _rp_MLISTP=$(echo "$_rp_LISTP" | sed 's|/[^/]*$||');
        _rp_CMD=("${_rp_CMD[@]//\{\/\/\}/$_rp_MLISTP}"); # {//} only dir
        _rp_MLISTP=$(echo "$_rp_LISTP" | sed 's|.*/||; s|\.[^.]*$||;');
        _rp_CMD=("${_rp_CMD[@]//\{\/\.\}/$_rp_MLISTP}"); # {/.} basename
      fi
    fi
    echo "THREAD:$_rp_THREAD:$_rp_NUMP starting" >> "$_rp_TMP/state";
    {
      if [ "$_rp_ARGPOS" != 0 ]; then
        "${_rp_CMD[@]:0:$_rp_ARGPOS}" "${_rp_LISTP[@]}" "${_rp_CMD[@]:$((_rp_ARGPOS+1))}";
      elif [ "$_rp_PIPEPOS" != 0 ]; then
        "${_rp_CMD[@]:0:$_rp_PIPEPOS}" <( printf '%s\n' "${_rp_LISTP[@]}" ) "${_rp_CMD[@]:$((_rp_PIPEPOS+1))}";
      elif [ "$_rp_FILEPOS" != 0 ]; then
        printf '%s\n' "${_rp_LISTP[@]}" > "$_rp_TMP/list_$_rp_NUMP";
        _rp_CMD=("${_rp_CMD[@]//\{@\}/$_rp_TMP/list_$_rp_NUMP}");
        "${_rp_CMD[@]}";
      elif [ "$_rp_OTHERARG" != 0 ] || [ "$_rp_LIST" = "" ]; then
        "${_rp_CMD[@]}";
      else
        printf '%s\n' "${_rp_LISTP[@]}" | "${_rp_CMD[@]}";
      fi
      local _rp_RC="$?";
      [ "$_rp_RC" != 0 ] && echo "THREAD:$_rp_THREAD:$_rp_NUMP $_rp_RC failed" >> "$_rp_TMP/state";
      echo "THREAD:$_rp_THREAD:$_rp_NUMP ended" >> "$_rp_TMP/state";
    } >> "$_rp_TMP/out_$_rp_THREAD" 2>> "$_rp_TMP/err_$_rp_THREAD" &
  }

  ### Run threads ###
  ( local _rp_NUMP=0;
    for _rp_THREAD in "${_rp_THREADS[@]}"; do
      #>> "$_rp_TMP/out_$_rp_THREAD";
      #>> "$_rp_TMP/err_$_rp_THREAD";
      _rp_NUMP=$((_rp_NUMP+1));
      _rp_runcmd "$_rp_THREAD" "$_rp_NUMP";
    done
    while true; do
      local _rp_NUMR=$(( $(grep -c ' starting$' "$_rp_TMP/state") - $(grep -c ' ended$' "$_rp_TMP/state") ));
      if [ "$_rp_NUMP" = "$_rp_TOTP" ] ||
         [ $(grep -c '^listdone$' "$_rp_TMP/state") != 0 ]; then
        wait;
        break;
      elif [ "$_rp_NUMR" -lt "$_rp_NTHREADS" ]; then
        _rp_NUMP=$((_rp_NUMP+1));
        _rp_THREAD=$(
          sed -n '/^THREAD:/{ s|^THREAD:\([^:]*\):[^ ]*|\1|; p; }' "$_rp_TMP/state" \
            | awk '
                { if( $NF == "ended" )
                    ended[$1] = "";
                  else if( $NF == "starting" )
                    delete ended[$1];
                } END {
                  for( job in ended ) { print job; break; }
                }' );
        _rp_runcmd "$_rp_THREAD" "$_rp_NUMP";
        continue;
      fi
      local _rp_ended;
      IFS= read -r -u$_rp_ENDFD _rp_ended;
    done
  )

  _rp_cleanup;
  return "$_rp_NTHREADS";
)}
