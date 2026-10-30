# 2단계 — 논거 세우기

> 과제 안내 2/5 대응: T10-C11 ~ C20. 논문 참고문헌(`paper/refs.bib`)과 같은 목록이다.

## 확인 방법 (C20)

1. AI(Claude)가 가설과 관련된 후보 문헌을 기억에서 제시했다. 이 단계의 목록은 **검증 전 자료**로 취급했다.
2. 각 후보를 웹 검색으로 찾고, 출판사·PubMed Central·기관 저장소 등 서지 정보가 있는 페이지를 열어 **저자, 연도, 학술지, 권(호), 쪽, DOI**를 대조했다.
3. 같은 페이지에서 초록(또는 서론)을 읽고, 이 연구의 어느 부분과 이어지는지 한 줄로 적었다. 숫자와 결론은 원문 페이지에서 직접 확인한 것만 적었다.
4. 서지 정보를 확인하지 못했거나 내용이 기억과 다르면 목록에서 지웠다.

확인 일자: 2026-10-30 (1차). 같은 날 별도 세션에서 10편 전부를 다시 검색해 재확인했다(2차, 아래 "2차 재검증" 절).
아래 "확인한 페이지"가 실제로 연 출처다.

## 참고문헌과 가설 연결 (C11–C16)

| # | 문헌 (C12·C13) | 확인한 페이지 | 실험·데이터 검증 연구 (C16) | 이 연구의 어느 부분을 뒷받침하나 (C14) |
|---|---|---|---|---|
| 1 | Posner, M. I., & Petersen, S. E. (1990). The attention system of the human brain. *Annual Review of Neuroscience, 13*, 25–42. doi:10.1146/annurev.ne.13.030190.000325 | Petersen & Posner (2012)의 PMC 본문 참고문헌 목록에서 서지 대조 (PubMed 원 페이지는 접속 확인 화면에 막힘) | 이론·리뷰 | 주의 체계에 '각성(alerting)' 기능이 따로 있다는 이론적 틀 → 가설의 원인 변수(경고 신호)가 왜 반응을 바꿀 수 있는지 |
| 2 | Petersen, S. E., & Posner, M. I. (2012). The attention system of the human brain: 20 years after. *Annual Review of Neuroscience, 35*, 73–89. doi:10.1146/annurev-neuro-062111-150525 | pmc.ncbi.nlm.nih.gov/articles/PMC3413263, vivo.weill.cornell.edu (PMID 22524787) | 리뷰 | 1990년 모형을 갱신해 각성·정향·실행 통제를 서로 다른 네트워크로 정리 → 각성(경고 신호의 효과)을 독립된 기능으로 다루는 근거. *2차 재검증에서 초록에 "경고 신호가 반응을 빠르게 한다"는 문장은 없음을 확인해, 가설 방향의 근거는 문헌 5로 옮김* |
| 3 | Fan, J., McCandliss, B. D., Sommer, T., Raz, A., & Posner, M. I. (2002). Testing the efficiency and independence of attentional networks. *Journal of Cognitive Neuroscience, 14*(3), 340–347. doi:10.1162/089892902317361886 | vivo.weill.cornell.edu (PMID 11970796) 서지·초록 | **실험** (성인 40명) | 반응시간 과제로 각성 효과를 개인 단위로 안정적으로 측정할 수 있다는 실험 근거 → 측정 방식(경고 유무 비교) |
| 4 | Niemi, P., & Näätänen, R. (1981). Foreperiod and simple reaction time. *Psychological Bulletin, 89*, 133–162. | Journal 논문 참고문헌 목록(informahealthcare.com, 10.1080/17470218.2010.532225)에서 학술지·권·쪽 대조. 원문 페이지는 직접 열지 못함 | 리뷰 | 경고와 목표 사이 간격(예비 기간)이 단순 반응시간을 바꾼다는 고전 정리 → 두 조건의 대기시간 분포를 같게 맞춘 설계 이유 |
| 5 | Weinbach, N., & Henik, A. (2012). Temporal orienting and alerting – the same or different? *Frontiers in Psychology, 3*, 236. doi:10.3389/fpsyg.2012.00236 | pmc.ncbi.nlm.nih.gov/articles/PMC3393878 | 리뷰 | (가) 중립적 경고 신호 뒤에는 신호가 없을 때보다 반응이 빠르다("Faster RTs are observed following these cues compared with a no-cue condition") → **가설의 방향(짧아진다)** / (나) 경고 신호는 각성과 '언제 나올지'에 대한 시간 정보를 함께 주므로 둘이 "commonly confounded in most experimental designs" → 이 연구의 **한계**(메커니즘 분리 불가) |
| 6 | Reimers, S., & Stewart, N. (2015). Presentation and response timing accuracy in Adobe Flash and HTML5/JavaScript Web experiments. *Behavior Research Methods, 47*(2), 309–327. doi:10.3758/s13428-014-0471-1 | wrap.warwick.ac.uk/id/eprint/66017 | **실험** (19개 시스템, 전용 측정 장비) | JavaScript 웹 실험이 대부분의 참가자 내 설계에서 조건 간 반응시간 차이를 잡아낼 수 있다는 근거 → 웹으로 측정해도 되는 이유 |
| 7 | Bridges, D., Pitiot, A., MacAskill, M. R., & Peirce, J. W. (2020). The timing mega-study: comparing a range of experiment generators, both lab-based and online. *PeerJ, 8*, e9414. doi:10.7717/peerj.9414 | doaj.org (PeerJ 2020 기록) | **실험** (측정 장비로 여러 프로그램·브라우저 비교) | 온라인 실험은 실험실보다 변동이 조금 크지만 다양한 연구에 쓸 수 있다는 근거 → 방법의 타당성과 한계 |
| 8 | Anwyl-Irvine, A., Dalmaijer, E. S., Hodges, N., & Evershed, J. K. (2021). Realistic precision and accuracy of online experiment platforms, web browsers, and devices. *Behavior Research Methods, 53*(4), 1407–1425. doi:10.3758/s13428-020-01501-5 | research-information.bris.ac.uk 서지·초록 | **실험** (로봇 작동기로 응답 측정) | 현대 웹 플랫폼의 화면 표시·응답 기록 정밀도가 쓸 만한 수준이라는 근거 → 방법의 타당성 |
| 9 | Pronk, T., Wiers, R. W., Molenkamp, B., & Murre, J. (2020). Mental chronometry in the pocket? Timing accuracy of web applications on touchscreen and keyboard devices. *Behavior Research Methods, 52*(3), 1371–1382. doi:10.3758/s13428-019-01321-2 | link.springer.com 해당 논문 페이지 | **실험** (터치스크린·키보드 기기 측정 + 시뮬레이션) | 기기마다 반응시간이 최소 수십 ms씩 과대 측정되지만, 같은 사람의 조건 간 차이(상대 RT)는 거의 영향받지 않는다 → **참가자 내 설계를 고른 핵심 근거** |
| 10 | Ratcliff, R. (1993). Methods for dealing with reaction time outliers. *Psychological Bulletin, 114*(3), 510–532. doi:10.1037/0033-2909.114.3.510 | scilit.com 서지·초록 | 방법론(시뮬레이션) | 중앙값 같은 강건한 통계가 이상값과 절단 기준의 영향을 훨씬 덜 받는다 → 참가자별 **중앙값**을 쓰고 절단 기준을 미리 고정한 근거 |

## 이미 알려진 사실과 이 연구가 새로 주장하는 것 (C17)

- **이미 알려진 것**: 실험실의 통제된 장비에서는 중립적 경고 신호가 단순 반응시간을 짧게 한다(문헌 1–3). 웹 브라우저는 조건 간 반응시간 차이를 잡아낼 만큼 정밀하다(문헌 6–9).
- **이 연구가 새로 확인하려는 것**: 참가자가 **자기 휴대폰·PC로, 감독 없는 환경에서** 하는 짧은 웹 과제에서도, UI 효과처럼 생긴 테두리 점등 신호가 같은 사람의 반응시간을 줄이는가. 새로운 이론이 아니라 기존 결과의 **현장 환경 재현**이다.

## 목록에서 뺀 항목 (C15)과 확인 과정에서 걸러낸 것

| 항목 | 처리 | 이유 |
|---|---|---|
| Woods et al. (2015) 단순 반응시간 영향 요인 연구 | 뺌 | AI가 후보로 떠올렸으나 서지를 직접 확인하지 않았다. 확인하지 않은 문헌은 넣지 않는다. |
| Whelan (2008) 반응시간 분석 방법 | 뺌 | 같은 이유. 같은 역할(이상값 처리 근거)은 확인한 Ratcliff(1993)가 맡는다. |
| Yarrow et al. (2026) 예비 기간 신념과 단순 반응시간 | 뺌 | 서지는 확인했으나 아직 학술지 게재본이 아닌 수락 원고이고, 이 연구 가설의 핵심(경고 유무)보다 예비 기간 모형에 초점이 있다. |
| 앞선 AI 초안의 주장: "불확실성이 높은 대기 상태에서는 주의가 분산되어 반응이 느려진다" | 근거로 쓰지 않음 | 확인한 자료는 오히려 대기시간이 무작위일 때 긴 대기 뒤 반응이 빨라지는 경향(위험 함수)을 설명한다. 단순화된 주장이라 버렸다. |
| Niemi & Näätänen (1981)의 DOI | 미기재 | 원문 페이지를 직접 열지 못해 DOI를 확인하지 못했다. 확인된 학술지·권·쪽만 적었다. |

## 2차 재검증 (2026-10-30, 별도 세션)

1차 목록을 그대로 믿지 않고, 같은 절차로 다시 확인했다. 셸에서 Crossref API 접근은 차단되어 있어 웹 검색과 페이지 열람으로 대조했다.

| # | 2차 확인 결과 | 연 페이지 |
|---|---|---|
| 1 | 서지 일치 | pubmed.ncbi.nlm.nih.gov/2183676 (검색 결과) |
| 2 | 서지 일치, DOI 일치. **초록에 경고 신호의 반응 단축 언급 없음 → 연결 문장 수정** | vivo.weill.cornell.edu/display/pubid22524787 |
| 3 | 학술지·권(호)·쪽·DOI 일치, 참가자 40명, "reliable single subject estimates" 확인 | scilit.net 서지 페이지 |
| 4 | 학술지·권·쪽 일치 (DOI는 여전히 원문에서 확인 못 함 → 미기재 유지) | Correa 외 문헌의 참고문헌 목록(link.springer.com, 10.3758/BF03205523) |
| 5 | 서지·DOI 일치, 위 인용 두 문장 원문 확인 | frontiersin.org 본문 |
| 6 | 서지 일치 | wrap.warwick.ac.uk/id/eprint/66017, openaccess.city.ac.uk/3678 |
| 7 | 서지 일치 | doaj.org, peerj.com/articles/9414 |
| 8 | 서지 일치 | research-information.bris.ac.uk, PMC8367876 (검색 결과) |
| 9 | 서지·DOI 일치. 초록: "RTs were consistently overestimated", 상대 RT가 절대 RT보다 덜 영향받음. 본문: 과대 측정이 "57 ms or more" | dare.uva.nl 저장소, link.springer.com 논문 페이지 |
| 10 | 서지 일치 | scilit.com 서지 페이지 |

**걸러낸 것:** 문헌 2의 연결 문장이 원문 초록으로 뒷받침되지 않아 고쳤다. 1차 확인에서 AI가 문헌 내용을 기억에 기대어 요약한 흔적이며, 이것이 "AI가 준 문헌은 직접 확인한다"는 규칙이 필요한 이유다.

## 실험·데이터로 검증된 연구 (C16)

문헌 3, 6, 7, 8, 9가 실제 측정 데이터를 가진 실험 연구다.
