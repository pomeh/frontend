package football.model

import feed.CompetitionSupport
import pa.FootballMatch
import math.{min, max}


object CacheTime extends implicits.Football {

  val maxCacheSeconds = 900 // 15 minutes
  val minCacheSeconds = 10

  def apply(matches: Seq[FootballMatch]): Int = {
    if (matches.exists(_.isLive)) {
      minCacheSeconds
    } else {
      val secondsToNextMatch = matches.filter(_.isFixture).map(_.secondsToStart).sorted.headOption
      secondsToNextMatch match {
        case None => maxCacheSeconds
        case Some(starts) => min(max(starts, minCacheSeconds), maxCacheSeconds).toInt
      }
    }
  }
}
