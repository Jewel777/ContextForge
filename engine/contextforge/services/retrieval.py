from __future__ import annotations



import re

from collections import Counter, defaultdict

from math import log

from time import perf_counter



from sentence_transformers import util



from ..config import (

    CHUNK_SENTENCE_OVERLAP,

    CHUNK_SENTENCE_SIZE,

    MAX_CHUNKS_FOR_SENTENCE_RANKING,

    NEAR_DUPLICATE_SIMILARITY,

)

from .embeddings import embedding_service

from .hybrid import rank_chunks_hybrid

from .reranker import reranker_service

from .evidence_classifier import classify_evidence

from .constraint_extractor import extract_constraints

from .facet_optimizer import plan_facet_coverage

from .context_manifest import build_context_manifest

from .hard_coverage_validator import validate_hard_evidence_coverage

from .hard_evidence_rescue import plan_targeted_hard_rescue

from .broad_recall_router import build_broad_recall_plan

from .broad_candidate_gate import build_broad_candidate_gate

from .fact_atomizer_v2 import atomize_scored_items

from .fact_level_compiler_semantic_v3 import compile_fact_atoms

from .semantic_evidence_role_v2 import semantic_role_classifier

from .text_utils import (

    dedupe_sentence_items,

    expanded_task_terms,

    importance_bonus,

    is_meta_sentence,

    mode_multiplier,

    terms,

    validate_mode,

)

from .tokenizer import count_tokens





_ACTION_WORDS = {

    "extract",

    "find",

    "identify",

    "summarize",

    "list",

    "show",

    "return",

    "retrieve",

    "preserve",

    "include",

    "provide",

    "give",

}



_NOISE_PATTERNS = (

    r"^\s*page\s+\d+\s*(?:of\s+\d+)?\s*$",

    r"^\s*(?:table\s+of\s+contents|contents|introduction|overview)\s*$",

    r"^\s*(?:chapter|section)\s+\d+(?:\.\d+)*\s*$",

)



_META_PHRASES = (

    "this manual is",

    "this document is",

    "this guide is",

    "this report is",

    "the purpose of this document",

    "the purpose of this manual",

    "intentionally verbose",

    "successful retrieval system",

    "context compiler",

    "document is organized",

    "the following sections",

)





def _group_key(item):

    if item.get("section"):

        return ("section", item["section"])

    if item.get("page") is not None:

        return ("page", item["page"])

    return ("plain", None)





def _build_chunks(items):

    groups = defaultdict(list)

    for index, item in enumerate(items):

        groups[_group_key(item)].append(index)



    chunks = []

    step = max(1, CHUNK_SENTENCE_SIZE - CHUNK_SENTENCE_OVERLAP)



    for group_key, indexes in groups.items():

        for start in range(0, len(indexes), step):

            chosen = indexes[start : start + CHUNK_SENTENCE_SIZE]

            if not chosen:

                continue



            chunks.append(

                {

                    "id": len(chunks),

                    "indexes": chosen,

                    "group_key": group_key,

                    "text": " ".join(items[i]["sentence"] for i in chosen),

                }

            )



            if start + CHUNK_SENTENCE_SIZE >= len(indexes):

                break



    return chunks





def _suffix(item):

    refs = []

    if item.get("page") is not None:

        refs.append(f'Page {item["page"]}')

    if item.get("section"):

        refs.append(item["section"])

    return f" [{' | '.join(refs)}]" if refs else ""





def _normalize_similarity(value: float) -> float:

    return max(0.0, min(1.0, (value + 1.0) / 2.0))





def _clean_facet(text: str) -> str:

    cleaned = text.strip(" \t\n\r.,;:-")

    if not cleaned:

        return ""



    cleaned = re.sub(

        r"^(?:extract|find|identify|summarize|list|show|return|retrieve|include|provide|give)\s+",

        "",

        cleaned,

        flags=re.IGNORECASE,

    )

    cleaned = re.sub(

        r"^(?:all\s+)?(?:mandatory|required|relevant|exact)\s+",

        "",

        cleaned,

        flags=re.IGNORECASE,

    )

    cleaned = re.sub(

        r"\b(?:requirements?|rules?|details?|information)\b$",

        "",

        cleaned,

        flags=re.IGNORECASE,

    ).strip()



    return cleaned





def _split_list_phrase(text: str) -> list[str]:

    parts = re.split(

        r"\s*(?:,|;|\band\b|\bplus\b|\balong with\b)\s*",

        text,

        flags=re.IGNORECASE,

    )



    out = []

    seen = set()



    for part in parts:

        cleaned = _clean_facet(part)

        if not cleaned:

            continue



        key = cleaned.lower()

        if key in seen:

            continue



        seen.add(key)

        out.append(cleaned)



    return out





def _parse_task_contract(task: str):

    """

    Parse the user's task into three distinct retrieval controls:



    include_facets:

        Topics that must be represented in the selected evidence.



    preserve_terms:

        Cross-cutting evidence attributes that should receive extra protection,

        such as limits, deadlines, ports, lifetimes, and thresholds.



    exclude_terms:

        Explicit distractor concepts that should receive a negative relevance

        signal and should not consume context budget.

    """

    normalized = re.sub(r"\s+", " ", task.strip())



    include_facets = []

    preserve_phrases = []

    exclude_phrases = []



    clauses = [

        clause.strip()

        for clause in re.split(r"(?<=[.!?])\s+", normalized)

        if clause.strip()

    ]



    for clause in clauses:

        lower = clause.lower()



        if lower.startswith(("exclude ", "omit ", "ignore ", "remove ")):

            body = re.sub(

                r"^(?:exclude|omit|ignore|remove)\s+",

                "",

                clause,

                flags=re.IGNORECASE,

            )

            exclude_phrases.extend(_split_list_phrase(body))

            continue



        if lower.startswith(("preserve ", "retain ", "keep ")):

            body = re.sub(

                r"^(?:preserve|retain|keep)\s+",

                "",

                clause,

                flags=re.IGNORECASE,

            )

            preserve_phrases.extend(_split_list_phrase(body))

            continue



        if lower.startswith(

            ("extract ", "find ", "identify ", "list ", "show ", "retrieve ", "return ")

        ):

            body = re.sub(

                r"^(?:extract|find|identify|list|show|retrieve|return)\s+",

                "",

                clause,

                flags=re.IGNORECASE,

            )

            body = re.sub(

                r"^(?:all\s+)?(?:mandatory|required|relevant)\s+",

                "",

                body,

                flags=re.IGNORECASE,

            )

            include_facets.extend(_split_list_phrase(body))



    # Fallback for simple one-sentence tasks.

    if not include_facets:

        include_facets = _split_list_phrase(normalized)



    generic_exclude_words = {

        "other",

        "unrelated",

        "operational",

        "detail",

        "details",

        "information",

        "content",

        "general",

    }



    preserve_terms = set()

    for phrase in preserve_phrases:

        preserve_terms.update(terms(phrase))



    exclude_terms = set()

    for phrase in exclude_phrases:

        exclude_terms.update(

            term

            for term in terms(phrase)

            if term not in generic_exclude_words

        )



    # Keep the number of retrieval lanes bounded and deterministic.

    include_facets = include_facets[:12]



    return include_facets, preserve_terms, exclude_terms





def _negative_overlap(sentence: str, exclude_terms: set[str]) -> set[str]:

    if not exclude_terms:

        return set()

    return terms(sentence) & exclude_terms





def _is_structural_noise(sentence: str, task_terms: set[str]) -> bool:

    text = sentence.strip()

    lower = text.lower()



    if not text:

        return True



    for pattern in _NOISE_PATTERNS:

        if re.match(pattern, text, flags=re.IGNORECASE):

            return True



    # Generic document-description prose should never consume evidence budget.

    # These are descriptions of the document/retrieval process, not evidence.

    if any(phrase in lower for phrase in _META_PHRASES):

        return True



    # Very short header-like fragments without useful task overlap.

    if len(text.split()) <= 4 and not (terms(text) & task_terms):

        if not re.search(r"\d", text):

            return True



    return False





def _idf_map(items, task_terms):

    if not task_terms:

        return {}



    document_count = max(1, len(items))

    document_frequency = Counter()



    for item in items:

        sentence_terms = terms(item["sentence"])

        for term in task_terms:

            if term in sentence_terms:

                document_frequency[term] += 1



    return {

        term: log((document_count + 1) / (document_frequency.get(term, 0) + 1)) + 1.0

        for term in task_terms

    }





def _lexical_features(sentence: str, task_terms, idf):

    sentence_terms = terms(sentence)

    overlap = sentence_terms & task_terms



    if not task_terms:

        return 0, 0.0, set()



    weighted_hits = sum(idf.get(term, 1.0) for term in overlap)

    possible = sum(idf.get(term, 1.0) for term in task_terms) or 1.0

    coverage = min(1.0, weighted_hits / possible)



    return len(overlap), coverage, overlap





def _section_task_score(section, task_terms, idf):

    if not section:

        return 0.0



    section_terms = terms(section)

    overlap = section_terms & task_terms

    if not overlap:

        return 0.0



    weighted = sum(idf.get(term, 1.0) for term in overlap)

    total = sum(idf.get(term, 1.0) for term in task_terms) or 1.0

    return min(1.0, weighted / total)





def _chunk_lexical_score(chunk_text, task_terms, idf):

    _, coverage, _ = _lexical_features(chunk_text, task_terms, idf)

    return coverage





def _adaptive_chunk_limit(total_chunks: int, source_sentences: int) -> int:

    if total_chunks <= MAX_CHUNKS_FOR_SENTENCE_RANKING:

        return total_chunks



    if source_sentences >= 1500:

        multiplier = 1.8

    elif source_sentences >= 700:

        multiplier = 1.6

    elif source_sentences >= 250:

        multiplier = 1.4

    else:

        multiplier = 1.2



    return min(

        total_chunks,

        max(

            MAX_CHUNKS_FOR_SENTENCE_RANKING,

            int(MAX_CHUNKS_FOR_SENTENCE_RANKING * multiplier),

        ),

    )





def _confidence(scored, selected, task_terms, covered_terms, facet_count, covered_facets):

    if not scored or not selected:

        return 0



    ranked = sorted(scored, key=lambda x: x["priority_score"], reverse=True)

    best = ranked[0]["priority_score"]

    second = ranked[1]["priority_score"] if len(ranked) > 1 else best * 0.75

    margin = max(0.0, best - second)



    selected_avg = sum(x["priority_score"] for x in selected) / len(selected)

    semantic_avg = sum(x["semantic_score"] for x in selected) / len(selected)



    term_coverage = (

        len(covered_terms) / max(1, len(task_terms))

        if task_terms

        else 0.0

    )

    facet_coverage = len(covered_facets) / max(1, facet_count)



    score = (

        min(1.0, best) * 24

        + min(1.0, selected_avg) * 20

        + min(1.0, semantic_avg) * 16

        + min(1.0, term_coverage) * 16

        + min(1.0, facet_coverage) * 16

        + min(1.0, margin / 0.18) * 8

    )



    return max(0, min(100, int(round(score))))





def _dynamic_semantic_threshold(scored, mode):

    semantic_scores = sorted(

        (item["semantic_score"] for item in scored),

        reverse=True,

    )



    if not semantic_scores:

        return 0.16



    best = semantic_scores[0]

    top_window = semantic_scores[: min(12, len(semantic_scores))]

    top_avg = sum(top_window) / len(top_window)



    base = max(0.14, best * mode_multiplier(mode))

    distribution_floor = max(0.14, top_avg * 0.68)



    if mode == "safe":

        threshold = min(base, distribution_floor)

    elif mode == "aggressive":

        threshold = max(base, distribution_floor)

    else:

        threshold = (base + distribution_floor) / 2.0



    return max(0.14, min(best, threshold))





def _query_scores(query_embeddings, candidate_embeddings):

    matrix = util.cos_sim(query_embeddings, candidate_embeddings)

    return [

        [_normalize_similarity(float(value)) for value in row]

        for row in matrix

    ]





def optimize_sentences(items, task, mode, token_budget):

    started = perf_counter()



    task = task.strip()

    if not task:

        raise ValueError("Task cannot be empty.")



    mode = validate_mode(mode)

    token_budget = max(20, int(token_budget))



    include_facets, preserve_terms, exclude_terms = _parse_task_contract(task)



    positive_query_text = " ".join(include_facets)

    if preserve_terms:

        positive_query_text += " " + " ".join(sorted(preserve_terms))



    task_terms = expanded_task_terms(positive_query_text or task)



    items = [

        item

        for item in dedupe_sentence_items(items)

        if not is_meta_sentence(item["sentence"])

        and not _is_structural_noise(item["sentence"], task_terms)

    ]



    if not items:

        raise ValueError("No readable text was found.")



    source_text = " ".join(item["sentence"] for item in items)

    source_tokens = count_tokens(source_text)



    idf = _idf_map(items, task_terms)



    facets = include_facets

    retrieval_queries = [positive_query_text or task] + facets



    chunks = _build_chunks(items)



    query_embeddings = embedding_service.encode_many(retrieval_queries)

    chunk_embeddings = embedding_service.encode_many(chunk["text"] for chunk in chunks)

    chunk_query_scores = _query_scores(query_embeddings, chunk_embeddings)



    # Step 1 architecture upgrade:

    # retrieve candidate chunks through two independent channels:

    #   1) dense semantic similarity (existing embedding model)

    #   2) BM25 lexical retrieval (exact terms, identifiers, numbers, units)

    # and fuse the rankings with Reciprocal Rank Fusion.

    chunk_limit = _adaptive_chunk_limit(len(chunks), len(items))



    fused_chunks = rank_chunks_hybrid(

        chunk_texts=[chunk["text"] for chunk in chunks],

        queries=retrieval_queries,

        semantic_scores_by_query=chunk_query_scores,

        top_k=chunk_limit,

    )



    base_chunk_indexes = [

        result.chunk_index

        for result in fused_chunks

    ]



    broad_recall_plan = None



    if len(facets) >= 4:

        broad_recall_plan = build_broad_recall_plan(

            chunk_texts=[chunk["text"] for chunk in chunks],

            queries=retrieval_queries,

            semantic_scores_by_query=chunk_query_scores,

            base_chunk_indexes=base_chunk_indexes,

            small_document_all_chunks=96,

            per_facet_k=8,

            hard_signal_semantic_floor=0.22,

            max_large_document_chunks=160,

        )

        chosen_chunk_indexes = list(broad_recall_plan.chunk_indexes)

    else:

        chosen_chunk_indexes = base_chunk_indexes



    chosen_chunks = [

        chunks[index]

        for index in chosen_chunk_indexes

    ]



    candidate_indexes = sorted(

        {index for chunk in chosen_chunks for index in chunk["indexes"]}

    )

    candidate_items = [items[index] for index in candidate_indexes]

    candidate_sentences = [item["sentence"] for item in candidate_items]



    sentence_embeddings = embedding_service.encode_many(candidate_sentences)

    sentence_query_scores = _query_scores(query_embeddings, sentence_embeddings)



    scored = []



    for local_index, item in enumerate(candidate_items):

        full_task_semantic = sentence_query_scores[0][local_index]



        facet_scores = {

            facets[i - 1]: sentence_query_scores[i][local_index]

            for i in range(1, len(retrieval_queries))

        }

        best_facet = max(

            facet_scores,

            key=facet_scores.get,

            default=None,

        )

        best_facet_score = facet_scores.get(best_facet, 0.0) if best_facet else 0.0



        semantic = max(full_task_semantic, best_facet_score)



        lexical_hits, lexical_coverage, overlap = _lexical_features(

            item["sentence"],

            task_terms,

            idf,

        )



        section_score = _section_task_score(

            item.get("section"),

            task_terms,

            idf,

        )



        importance = min(0.25, max(0.0, importance_bonus(item["sentence"])))



        sentence_terms = terms(item["sentence"])

        negative_terms = _negative_overlap(item["sentence"], exclude_terms)

        preserve_overlap = sentence_terms & preserve_terms



        negative_penalty = min(0.36, len(negative_terms) * 0.16)



        evidence = classify_evidence(item["sentence"])

        constraints = extract_constraints(item["sentence"])



        priority = (

            semantic * 0.50

            + full_task_semantic * 0.10

            + lexical_coverage * 0.17

            + section_score * 0.08

            + importance * 0.15

        )



        priority += min(0.08, lexical_hits * 0.018)



        # Cross-cutting preservation cues: exact limits/deadlines/ports/etc.

        if preserve_overlap:

            priority += min(0.08, len(preserve_overlap) * 0.025)



        # Step 3: protect enforceable / numeric evidence without allowing

        # unrelated numbers to dominate retrieval. Evidence strength is only

        # applied when there is already meaningful semantic facet support.

        if evidence.strength > 0 and best_facet_score >= 0.50:

            priority += min(0.10, evidence.strength * 0.10)



        # Step 4: structured constraints receive a bounded preservation bonus.

        # This never creates relevance by itself; it only protects concrete

        # facts that are already semantically tied to the user's task.

        if constraints and best_facet_score >= 0.50:

            priority += min(0.07, 0.025 * len(constraints))



        # Numeric / mandatory evidence is protected only when it belongs to a

        # requested domain, preventing unrelated numbers from being rescued.

        if importance >= 0.07 and best_facet_score >= 0.56:

            priority += 0.04



        priority -= negative_penalty

        priority = min(1.25, max(0.0, priority))



        scored.append(

            {

                "source_index": candidate_indexes[local_index],

                "local_index": local_index,

                "sentence": item["sentence"],

                "source_sentence": item.get("source_sentence", item["sentence"]),

                "atom_id": item.get("atom_id"),

                "page": item.get("page"),

                "section": item.get("section"),

                "semantic_score": round(semantic, 4),

                "full_task_semantic": round(full_task_semantic, 4),

                "best_facet": best_facet,

                "best_facet_score": round(best_facet_score, 4),

                "facet_scores": facet_scores,

                "lexical_hits": lexical_hits,

                "lexical_coverage": round(lexical_coverage, 4),

                "section_score": round(section_score, 4),

                "importance_bonus": round(importance, 4),

                "matched_terms": overlap,

                "preserve_terms": preserve_overlap,

                "negative_terms": negative_terms,

                "negative_penalty": round(negative_penalty, 4),

                "evidence_type": evidence.primary.value,

                "evidence_labels": [label.value for label in evidence.labels],

                "evidence_strength": round(evidence.strength, 4),

                "has_number": evidence.has_number,

                "has_unit": evidence.has_unit,

                "has_constraint": evidence.has_constraint,

                "structured_constraints": [fact.to_dict() for fact in constraints],

                "constraint_count": len(constraints),

                "priority_score": round(priority, 4),

            }

        )



    threshold = _dynamic_semantic_threshold(scored, mode)



    best_semantic = max(item["semantic_score"] for item in scored)

    strong_cutoff = best_semantic - 0.12



    strong_neighbor_indexes = set()



    for strong_item in scored:

        if strong_item["semantic_score"] < strong_cutoff:

            continue



        for nearby_item in scored:

            same_section = nearby_item.get("section") == strong_item.get("section")

            nearby = abs(

                nearby_item["source_index"] - strong_item["source_index"]

            ) <= 1



            if same_section and nearby:

                strong_neighbor_indexes.add(nearby_item["source_index"])



    # Per-facet rescue: every task facet gets at least its best plausible sentence

    # into the candidate pool before global MMR packing.

    facet_best_indexes = set()



    for facet in facets:

        facet_ranked = sorted(

            scored,

            key=lambda item: item["facet_scores"].get(facet, 0.0),

            reverse=True,

        )



        if not facet_ranked:

            continue



        best_for_facet = facet_ranked[0]

        facet_score = best_for_facet["facet_scores"].get(facet, 0.0)



        if (

            facet_score >= 0.55

            and not best_for_facet["negative_terms"]

        ):

            facet_best_indexes.add(best_for_facet["source_index"])



    legacy_candidates = [

        item

        for item in scored

        if (

            not item["negative_terms"]

            or (

                item["best_facet_score"] >= 0.70

                and item["lexical_hits"] >= 2

            )

        )

        and (

            item["source_index"] in facet_best_indexes

            or item["semantic_score"] >= strong_cutoff

            or (

                item["lexical_hits"] >= 1

                and item["semantic_score"] >= best_semantic - 0.21

            )

            or (

                item["importance_bonus"] >= 0.07

                and item["source_index"] in strong_neighbor_indexes

                and item["semantic_score"] >= best_semantic - 0.20

            )

            or item["section_score"] >= 0.12

        )

    ]



    if not legacy_candidates:

        legacy_candidates = sorted(

            scored,

            key=lambda x: x["priority_score"],

            reverse=True,

        )[: min(8, len(scored))]



    candidate_gate = build_broad_candidate_gate(

        scored=scored,

        facets=facets,

        legacy_candidates=legacy_candidates,

        token_budget=token_budget,

        per_facet_k=12,

        min_facet_score=0.30,

        evidence_floor=0.24,

        max_candidates=96,

    )



    gated_source_indexes = set(candidate_gate.source_indexes)



    candidates = [

        item

        for item in scored

        if int(item["source_index"]) in gated_source_indexes

    ]



    wrapper = f"TASK\n{task}\n\nRELEVANT CONTEXT\n"

    available = max(0, token_budget - count_tokens(wrapper))



    selected = []

    selected_embs = []

    covered_terms = set()

    covered_facets = set()

    selected_sections = Counter()



    used_tokens = 0

    duplicate_indexes = set()



    def try_select(item):

        nonlocal used_tokens



        if item in selected:

            return False



        rendered = f'- {item["sentence"]}{_suffix(item)}\n'

        tokens_needed = count_tokens(rendered)



        if used_tokens + tokens_needed > available:
            return False

        emb = sentence_embeddings[item["local_index"]]



        redundancy = max(

            [util.cos_sim(emb, previous).item() for previous in selected_embs]

            or [0.0]

        )



        if redundancy >= NEAR_DUPLICATE_SIMILARITY:

            duplicate_indexes.add(item["local_index"])

            return False



        selected.append(item)

        selected_embs.append(emb)

        used_tokens += tokens_needed

        covered_terms.update(item["matched_terms"])



        if item.get("best_facet"):

            covered_facets.add(item["best_facet"])



        if item.get("section"):

            selected_sections[item["section"]] += 1



        return True



    # Step 2 architecture upgrade:

    # neural cross-encoder reranking over the bounded candidate pool.

    #

    # Hybrid retrieval maximizes recall; the cross-encoder now judges

    # task/candidate relevance jointly. If the model cannot load, the service

    # falls back to the existing priority scores so the engine still works.

    if candidates:

        rerank_query = positive_query_text or task

        fallback_scores = [

            item["priority_score"]

            for item in candidates

        ]



        reranked = reranker_service.rerank(

            query=rerank_query,

            candidates=[item["sentence"] for item in candidates],

            fallback_scores=fallback_scores,

            top_k=len(candidates),

        )



        rerank_scores = {

            result.index: result.score

            for result in reranked

        }



        # Normalize neural scores into [0, 1] for stable blending with the

        # existing deterministic priority score.

        neural_values = list(rerank_scores.values())



        if neural_values:

            min_score = min(neural_values)

            max_score = max(neural_values)

            span = max_score - min_score



            for index, item in enumerate(candidates):

                raw_score = rerank_scores.get(index, fallback_scores[index])



                if span > 1e-9:

                    normalized = (raw_score - min_score) / span

                else:

                    normalized = 0.5



                item["reranker_score_raw"] = round(float(raw_score), 6)

                item["reranker_score"] = round(float(normalized), 6)



                # Keep the proven deterministic score dominant enough to avoid

                # destabilizing regression behavior while allowing the neural

                # model to meaningfully reorder ambiguous candidates.

                item["priority_score"] = round(

                    item["priority_score"] * 0.62

                    + normalized * 0.38,

                    6,

                )

        else:

            for item in candidates:

                item["reranker_score_raw"] = None

                item["reranker_score"] = None



    # Step 5: coverage-constrained evidence planning.

    #

    # Narrow tasks preserve the proven Step 4 behavior. Broad multi-domain

    # requests use an explicit optimizer so one high-similarity topic cannot

    # monopolize the token budget.

    facet_reserve = max(1, int(available * 0.64))

    reserve_used = 0



    if len(facets) >= 4:

        token_costs = [

            count_tokens(f'- {item["sentence"]}{_suffix(item)}\n')

            for item in candidates

        ]



        coverage_plan = plan_facet_coverage(

            candidates=candidates,

            facets=facets,

            token_costs=token_costs,

            token_budget=facet_reserve,

            max_per_facet=3,

            min_facet_score=0.50,

        )



        for pick in coverage_plan:

            item = candidates[pick.candidate_index]

            rendered_tokens = token_costs[pick.candidate_index]



            if try_select(item):

                covered_facets.add(pick.facet)

                reserve_used += rendered_tokens

                item["coverage_optimizer_facet"] = pick.facet

                item["coverage_optimizer_score"] = round(pick.score, 6)

                item["coverage_optimizer_gain"] = round(pick.marginal_gain, 6)

    else:

        # Exact legacy coverage behavior for narrow requests.

        for facet in facets:

            ranked_for_facet = sorted(

                candidates,

                key=lambda item: (

                    item["facet_scores"].get(facet, 0.0),

                    item["priority_score"],

                ),

                reverse=True,

            )



            for item in ranked_for_facet:

                facet_score = item["facet_scores"].get(facet, 0.0)

                if facet_score < 0.55:

                    break



                if item["negative_terms"]:

                    continue



                rendered_tokens = count_tokens(

                    f'- {item["sentence"]}{_suffix(item)}\n'

                )



                if reserve_used + rendered_tokens > facet_reserve and selected:

                    break



                if try_select(item):

                    covered_facets.add(facet)

                    reserve_used += rendered_tokens

                    break



    # Pass 2: global evidence-aware MMR packing.

    remaining = [item for item in candidates if item not in selected]



    while remaining:

        best_item = None

        best_value = float("-inf")



        for item in remaining:

            rendered = f'- {item["sentence"]}{_suffix(item)}\n'

            tokens_needed = count_tokens(rendered)



            if used_tokens + tokens_needed > available:

                continue



            emb = sentence_embeddings[item["local_index"]]



            redundancy = max(

                [util.cos_sim(emb, previous).item() for previous in selected_embs]

                or [0.0]

            )



            if redundancy >= NEAR_DUPLICATE_SIMILARITY:

                duplicate_indexes.add(item["local_index"])

                continue



            new_terms = item["matched_terms"] - covered_terms

            weighted_new_coverage = sum(

                idf.get(term, 1.0) for term in new_terms

            )



            facet_bonus = 0.0

            best_facet = item.get("best_facet")

            if best_facet and best_facet not in covered_facets:

                facet_bonus = min(

                    0.14,

                    item["best_facet_score"] * 0.16,

                )



            section = item.get("section")

            section_diversity_bonus = 0.0

            if section:

                previous_from_section = selected_sections[section]

                section_diversity_bonus = (

                    0.035

                    if previous_from_section == 0

                    else -min(0.08, previous_from_section * 0.025)

                )



            page_diversity_bonus = 0.0

            if item.get("page") is not None:

                seen_pages = {

                    selected_item.get("page")

                    for selected_item in selected

                    if selected_item.get("page") is not None

                }

                if item["page"] not in seen_pages:

                    page_diversity_bonus = 0.025



            evidence_bonus = 0.0

            if item["importance_bonus"] >= 0.07:

                evidence_bonus = 0.04

            if item["preserve_terms"]:

                evidence_bonus += min(0.06, len(item["preserve_terms"]) * 0.02)



            if item.get("evidence_strength", 0.0) > 0 and item["best_facet_score"] >= 0.50:

                evidence_bonus += min(

                    0.07,

                    item["evidence_strength"] * 0.07,

                )



            if item.get("constraint_count", 0) > 0 and item["best_facet_score"] >= 0.50:

                evidence_bonus += min(

                    0.05,

                    item["constraint_count"] * 0.02,

                )



            value = (

                item["priority_score"]

                + min(0.12, weighted_new_coverage * 0.035)

                + facet_bonus

                + section_diversity_bonus

                + page_diversity_bonus

                + evidence_bonus

                - item["negative_penalty"]

                - 0.14 * max(0.0, redundancy)

            )



            if mode == "aggressive":

                value -= min(

                    0.08,

                    tokens_needed / max(1, available) * 0.25,

                )



            if value > best_value:

                best_item = item

                best_value = value



        if best_item is None:

            break



        try_select(best_item)

        remaining.remove(best_item)



    if not selected:

        fallback = max(candidates, key=lambda item: item["priority_score"])

        selected = [fallback]

        covered_terms.update(fallback["matched_terms"])

        if fallback.get("best_facet"):

            covered_facets.add(fallback["best_facet"])



    # Step 7b: targeted hard-evidence rescue for broad extraction contracts.

    #

    # Only facets with fewer than the required number of hard evidence units

    # are searched. This avoids the regression caused by globally widening the

    # candidate pool.

    hard_rescue_added = 0

    hard_rescue_facets = set()



    if len(facets) >= 4:

        rescue_plan = plan_targeted_hard_rescue(

            scored=scored,

            selected=selected,

            facets=facets,

            min_hard_per_facet=3,

            min_facet_score=0.42,

            max_additions=18,

        )



        scored_by_source = {

            int(item["source_index"]): item

            for item in scored

        }



        for rescue in rescue_plan:

            item = scored_by_source.get(rescue.source_index)

            if item is None:

                continue



            # Reuse the normal budget/duplicate guard.

            if try_select(item):

                item["hard_rescue_facet"] = rescue.facet

                item["hard_rescue_score"] = round(rescue.score, 6)

                hard_rescue_added += 1

                hard_rescue_facets.add(rescue.facet)



    fact_compile = None

    fact_atoms = []

    selected_atoms = []



    objective_guard_added = 0

    objective_guard_facets = set()



    # Semantic fact compilation must also run for short inputs when the

    # task explicitly asks to exclude unrelated material. Otherwise the

    # non-broad path can retain obvious distractors simply because the

    # whole source fits inside the token budget.

    semantic_filter_requested = bool(

        re.search(

            r"\b(?:exclude|excluding|omit|ignore|remove|without|unrelated|irrelevant|only)\b",

            task,

            re.I,

        )

    )



    if candidate_gate.broad_mode or semantic_filter_requested or len(facets) > 1:

        fact_atoms = atomize_scored_items(

            scored=scored,

            facets=facets,

        )



        atom_token_costs = {

            atom.atom_id: count_tokens(

                f'- {atom.text}'

                + (f' [p{atom.page}]' if atom.page is not None else '')

                + '\n'

            )

            for atom in fact_atoms

        }



        role_predictions_list = [None] * len(fact_atoms)

        atoms_by_relevance_query = {}



        for index, atom in enumerate(fact_atoms):

             # Semantic role classification should evaluate relevance against

             # the user's complete extraction contract, not an isolated facet

             # phrase such as "rate limits" or "deprecation date".

            relevance_query = task



            atoms_by_relevance_query.setdefault(relevance_query, []).append(

                  (index, atom)

            )



        for relevance_query, entries in atoms_by_relevance_query.items():

            predictions = semantic_role_classifier.classify_many(

                task=relevance_query,

                evidence_texts=[atom.text for _, atom in entries],

            )



            for (index, _), prediction in zip(entries, predictions):

                role_predictions_list[index] = prediction



        semantic_roles = {

            atom.atom_id: prediction

            for atom, prediction in zip(fact_atoms, role_predictions_list)

            if prediction is not None

        }



        fact_compile = compile_fact_atoms(

            atoms=fact_atoms,

            facets=facets,

            token_costs=atom_token_costs,

            token_budget=available,

            facet_floor=4,

            semantic_roles=semantic_roles,

        )



        selected_atom_ids = set(fact_compile.selected_atom_ids)



        selected_atoms = [

            atom

            for atom in fact_atoms

            if atom.atom_id in selected_atom_ids

        ]



        atom_by_id = {

            atom.atom_id: atom

            for atom in selected_atoms

        }



        selected_atoms = [

            atom_by_id[atom_id]

            for atom_id in fact_compile.selected_atom_ids

            if atom_id in atom_by_id

        ]



        selected = [

            atom.to_item()

            for atom in selected_atoms

        ]



        used_tokens = fact_compile.used_tokens



        covered_terms = set()

        covered_facets = set()



        for atom in selected_atoms:

            if atom.facet:

                covered_facets.add(atom.facet)



            covered_facets.update(

                facet

                for facet in getattr(atom, "matched_facets", ())

                if facet

            )

        selected_sections = Counter(

            atom.section

            for atom in selected_atoms

            if atom.section

        )



        for item in selected:

         item["fact_atom_selected"] = True



        # Objective Coverage Guard
        #
        # If fact compilation leaves an explicitly requested facet uncovered,
        # rescue the best already-retrieved fact atom for that facet without
        # widening retrieval or exceeding the existing token budget.
        # Some requested objectives are not satisfied merely because a facet
        # label is present. Numeric objectives such as limits, rates, sizes,
        # dates, thresholds, quotas, timeouts, and lifetimes require concrete
        # numeric evidence rather than a descriptive sibling clause.
        numeric_objective_terms = {
            "limit",
            "limits",
            "rate",
            "rates",
            "size",
            "date",
            "deadline",
            "threshold",
            "thresholds",
            "quota",
            "quotas",
            "timeout",
            "timeouts",
            "duration",
            "durations",
            "lifetime",
            "lifetimes",
            "maximum",
            "minimum",
            "max",
            "min",
        }

        def atom_has_numeric_objective_signal(atom, facet=None):
            evidence_type = str(
                getattr(atom, "evidence_type", "") or ""
            ).upper()

            if not getattr(atom, "has_number", False):
                return False

            atom_text_lower = atom.text.lower()

            if facet:
                facet_terms = terms(facet)

                size_units = {
                    "kb",
                    "mb",
                    "gb",
                    "tb",
                    "kib",
                    "mib",
                    "gib",
                    "tib",
                    "byte",
                    "bytes",
                }

                rate_markers = {
                    "rps",
                    "qps",
                    "rpm",
                    "requests/sec",
                    "requests/second",
                    "requests/min",
                    "requests/minute",
                }

                if {"size", "payload"} & facet_terms:
                    return any(
                        re.search(
                            rf"(?<![a-z0-9]){re.escape(unit)}(?![a-z0-9])",
                            atom_text_lower,
                        )
                        for unit in size_units
                    )

                if {"rate", "rates"} & facet_terms:
                    return any(
                        marker in atom_text_lower
                        for marker in rate_markers
                    )

                if {"date", "deadline"} & facet_terms:
                    return bool(
                        re.search(
                            r"\b(?:"
                            r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|"
                            r"apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
                            r"aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|"
                            r"nov(?:ember)?|dec(?:ember)?"
                            r")\b",
                            atom_text_lower,
                            re.I,
                        )
                        or re.search(
                            r"\b\d{4}-\d{1,2}-\d{1,2}\b",
                            atom_text_lower,
                        )
                    )

            return bool(
                getattr(atom, "has_unit", False)
                or bool(
                    getattr(
                        atom,
                        "structured_constraints",
                        (),
                    )
                )
                or evidence_type
                in {
                    "THRESHOLD",
                    "NUMERIC_CONSTRAINT",
                    "DEADLINE",
                }
            )

        def selected_atoms_for_facet(facet):
            facet_terms = terms(facet)

            return [
                atom
                for atom in selected_atoms
                if (
                    atom.facet == facet
                    or facet
                    in getattr(
                        atom,
                        "matched_facets",
                        (),
                    )
                    or (
                        facet_terms
                        and facet_terms
                        == terms(atom.facet or "")
                    )
                )
            ]

        missing_facets = []

        for facet in facets:
            facet_terms = terms(facet)
            facet_selected_atoms = selected_atoms_for_facet(facet)

            if not facet_selected_atoms:
                missing_facets.append(facet)
                continue

            requires_numeric = bool(
                facet_terms & numeric_objective_terms
            )

            if (
                requires_numeric
                and not any(
                    atom_has_numeric_objective_signal(
                        atom,
                        facet,
                    )
                    for atom in facet_selected_atoms
                )
            ):
                missing_facets.append(facet)

        selected_atom_ids_guard = {
            atom.atom_id
            for atom in selected_atoms
        }

        facet_stopwords = {
            "the",
            "a",
            "an",
        }

        for missing_facet in missing_facets:
            rescue_candidates = []

            missing_facet_terms = {
                term
                for term in terms(missing_facet)
                if term not in facet_stopwords
            }

            if not missing_facet_terms:
                continue

            for atom in fact_atoms:
                if atom.atom_id in selected_atom_ids_guard:
                    continue

                facet_scores = dict(
                    getattr(atom, "facet_scores", ())
                )

                matched_facets = getattr(
                    atom,
                    "matched_facets",
                    (),
                )

                atom_facet_terms = {
                    term
                    for term in terms(atom.facet or "")
                    if term not in facet_stopwords
                }

                matched_facet_term_sets = [
                    {
                        term
                        for term in terms(facet)
                        if term not in facet_stopwords
                    }
                    for facet in matched_facets
                ]

                semantic_match = (
                    missing_facet_terms == atom_facet_terms
                    or missing_facet_terms in matched_facet_term_sets
                )

                if not semantic_match:
                    continue

                facet_score = float(
                    facet_scores.get(
                        missing_facet,
                        getattr(atom, "facet_score", 0.0),
                    )
                )

                minimum_score = 0.20 if atom.hard else 0.42

                if facet_score < minimum_score:
                    continue

                atom_terms = terms(atom.text)
                lexical_overlap = missing_facet_terms & atom_terms

                evidence_type = str(
                    getattr(atom, "evidence_type", "") or ""
                ).upper()

                structured_numeric = bool(
                    getattr(atom, "has_number", False)
                    and (
                        getattr(atom, "has_unit", False)
                        or bool(
                            getattr(
                                atom,
                                "structured_constraints",
                                (),
                            )
                        )
                        or evidence_type
                        in {
                            "THRESHOLD",
                            "NUMERIC_CONSTRAINT",
                            "DEADLINE",
                        }
                    )
                )

                # Normal rescue requires direct lexical evidence. A narrow
                # exception protects numeric technical clauses assigned
                # directly to the requested facet.
                if not lexical_overlap:
                    if not (
                        structured_numeric
                        and missing_facet_terms == atom_facet_terms
                    ):
                        continue

                prediction = semantic_roles.get(atom.atom_id)
                if prediction is not None:
                    role = str(
                        getattr(prediction, "role", "") or ""
                    ).upper()
                    confidence = float(
                        getattr(prediction, "confidence", 0.0)
                        or 0.0
                    )
                    relevance = float(
                        getattr(prediction, "relevance", 0.5)
                        or 0.0
                    )

                    strongly_irrelevant = (
                        "IRRELEVANT" in role
                        and confidence >= 0.90
                        and relevance <= 0.10
                    )

                    # A strong semantic veto may be overridden only when the
                    # numeric evidence is structurally compatible with the
                    # requested objective. This prevents unrelated values such
                    # as token lifetimes from being rescued for facets like
                    # encryption-at-rest.
                    atom_text_lower = atom.text.lower()

                    size_units = {
                        "kb",
                        "mb",
                        "gb",
                        "tb",
                        "kib",
                        "mib",
                        "gib",
                        "tib",
                        "byte",
                        "bytes",
                    }

                    rate_markers = {
                        "rps",
                        "qps",
                        "rpm",
                        "requests/sec",
                        "requests/second",
                        "requests/min",
                        "requests/minute",
                    }

                    facet_unit_compatible = False

                    if {"size", "payload"} & missing_facet_terms:
                        facet_unit_compatible = any(
                            re.search(
                                rf"(?<![a-z0-9]){re.escape(unit)}(?![a-z0-9])",
                                atom_text_lower,
                            )
                            for unit in size_units
                        )

                    elif {"rate", "rates"} & missing_facet_terms:
                        facet_unit_compatible = any(
                            marker in atom_text_lower
                            for marker in rate_markers
                        )

                    elif {"date", "deadline"} & missing_facet_terms:
                        facet_unit_compatible = bool(
                            re.search(
                                r"\b(?:"
                                r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|"
                                r"apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
                                r"aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|"
                                r"nov(?:ember)?|dec(?:ember)?"
                                r")\b",
                                atom_text_lower,
                                re.I,
                            )
                            or re.search(
                                r"\b\d{4}-\d{1,2}-\d{1,2}\b",
                                atom_text_lower,
                            )
                        )

                    if strongly_irrelevant and not (
                        structured_numeric
                        and missing_facet_terms == atom_facet_terms
                        and facet_unit_compatible
                    ):
                        continue

                rescue_candidates.append(
                    (atom, facet_score)
                )

            rescue_candidates.sort(
                key=lambda entry: (
                    1 if entry[0].hard else 0,
                    entry[1],
                    float(
                        getattr(
                            entry[0],
                            "evidence_strength",
                            0.0,
                        )
                        or 0.0
                    ),
                    float(
                        getattr(
                            entry[0],
                            "priority_score",
                            0.0,
                        )
                        or 0.0
                    ),
                ),
                reverse=True,
            )

            for atom, _facet_score in rescue_candidates:
                tokens_needed = atom_token_costs.get(
                    atom.atom_id,
                    count_tokens(f"- {atom.text}\n"),
                )

                if used_tokens + tokens_needed > available:
                    # Tight-budget coverage swap: make room for a missing
                    # requested facet by evicting one redundant selected atom
                    # from an already-covered requested facet.
                    facet_coverage_counts = {facet: 0 for facet in facets}

                    for selected_atom in selected_atoms:
                        atom_facets = set(
                            getattr(selected_atom, "matched_facets", ())
                        )
                        if selected_atom.facet:
                            atom_facets.add(selected_atom.facet)

                        for facet in facets:
                            if facet in atom_facets:
                                facet_coverage_counts[facet] += 1

                    eviction_candidates = []

                    for selected_atom in selected_atoms:
                        atom_facets = set(
                            getattr(selected_atom, "matched_facets", ())
                        )
                        if selected_atom.facet:
                            atom_facets.add(selected_atom.facet)

                        requested_atom_facets = {
                            facet for facet in atom_facets if facet in facets
                        }

                        if not requested_atom_facets:
                            continue

                        # Preserve at least one selected atom for every
                        # requested facet already represented.
                        if any(
                            facet_coverage_counts.get(facet, 0) <= 1
                            for facet in requested_atom_facets
                        ):
                            continue

                        eviction_cost = atom_token_costs.get(
                            selected_atom.atom_id,
                            count_tokens(f"- {selected_atom.text}\n"),
                        )

                        if (
                            used_tokens - eviction_cost + tokens_needed
                            > available
                        ):
                            continue

                        eviction_candidates.append(
                            (selected_atom, eviction_cost)
                        )

                    if eviction_candidates:
                        # Evict the weakest redundant atom first. This naturally
                        # keeps numeric/unit-bearing constraints ahead of a
                        # descriptive sibling clause from the same facet.
                        eviction_candidates.sort(
                            key=lambda entry: (
                                float(
                                    getattr(
                                        entry[0],
                                        "evidence_strength",
                                        0.0,
                                    )
                                    or 0.0
                                ),
                                1
                                if getattr(entry[0], "has_number", False)
                                else 0,
                                1
                                if getattr(entry[0], "has_unit", False)
                                else 0,
                                float(
                                    getattr(
                                        entry[0],
                                        "priority_score",
                                        0.0,
                                    )
                                    or 0.0
                                ),
                                -entry[1],
                            )
                        )

                        evicted_atom, evicted_cost = eviction_candidates[0]
                        selected_atoms.remove(evicted_atom)
                        selected_atom_ids_guard.discard(evicted_atom.atom_id)
                        selected[:] = [
                            item
                            for item in selected
                            if item.get("atom_id") != evicted_atom.atom_id
                        ]
                        used_tokens -= evicted_cost

                        if evicted_atom.section:
                            selected_sections[evicted_atom.section] -= 1
                            if selected_sections[evicted_atom.section] <= 0:
                                del selected_sections[evicted_atom.section]

                    if used_tokens + tokens_needed > available:
                        continue

                selected_atoms.append(atom)
                selected_atom_ids_guard.add(atom.atom_id)

                rescued_item = atom.to_item()
                rescued_item["fact_atom_selected"] = True
                rescued_item["objective_guard_selected"] = True
                rescued_item["objective_guard_facet"] = missing_facet

                selected.append(rescued_item)

                used_tokens += tokens_needed

                if atom.facet:
                    covered_facets.add(atom.facet)

                covered_facets.update(
                    facet
                    for facet in getattr(
                        atom,
                        "matched_facets",
                        (),
                    )
                    if facet
                )

                covered_facets.add(missing_facet)

                if atom.section:
                    selected_sections[atom.section] += 1

                objective_guard_added += 1
                objective_guard_facets.add(missing_facet)

                break

                    # Recompute final facet coverage from the evidence that actually
        # survived compilation/rescue. Numeric objectives only count as
        # covered when the selected evidence contains a compatible numeric
        # signal for that specific facet.
        covered_facets = set()

        for facet in facets:
            facet_terms = terms(facet)
            facet_selected_atoms = selected_atoms_for_facet(facet)

            if not facet_selected_atoms:
                continue

            requires_numeric = bool(
                facet_terms & numeric_objective_terms
            )

            if (
                requires_numeric
                and not any(
                    atom_has_numeric_objective_signal(
                        atom,
                        facet,
                    )
                    for atom in facet_selected_atoms
                )
            ):
                continue

            covered_facets.add(facet)

    # Sanitize explainability metadata after final selection.
    # Numeric facets are exposed on a selected source only when that
    # specific atom contains a compatible numeric signal for the facet.
    if fact_compile is not None:
        selected_atom_lookup = {
            atom.atom_id: atom
            for atom in selected_atoms
        }

        for item in selected:
            atom = selected_atom_lookup.get(item.get("atom_id"))
            if atom is None:
                continue

            validated_matched_facets = []

            for matched_facet in getattr(atom, "matched_facets", ()):
                matched_facet_terms = terms(matched_facet)
                requires_numeric = bool(
                    matched_facet_terms & numeric_objective_terms
                )

                if (
                    requires_numeric
                    and not atom_has_numeric_objective_signal(
                        atom,
                        matched_facet,
                    )
                ):
                    continue

                validated_matched_facets.append(matched_facet)

            item["matched_facets"] = validated_matched_facets

    selected.sort(

        key=lambda item: (

            item["source_index"],

            item.get("atom_id", ""),

        )

    )



    # Explainability-only rejected evidence. Derived after selection so it

    # cannot influence ranking, recall, packing, or token budgeting.

    if fact_compile is not None:

        selected_atom_ids_for_explain = {

            item.get("atom_id")

            for item in selected

            if item.get("atom_id") is not None

        }

        rejected_evidence = []

        for atom in fact_atoms:

            if atom.atom_id in selected_atom_ids_for_explain:

                continue

            item = atom.to_item()

            prediction = semantic_roles.get(atom.atom_id)



            role = None

            confidence = None

            relevance = None

            if prediction is not None:

                role = (

                    getattr(prediction, "role", None)

                    or getattr(prediction, "label", None)

                    or getattr(prediction, "semantic_role", None)

                )

                confidence = (

                    getattr(prediction, "confidence", None)

                    or getattr(prediction, "semantic_confidence", None)

                )

                relevance = (

                    getattr(prediction, "relevance", None)

                    or getattr(prediction, "relevance_score", None)

                    or getattr(prediction, "semantic_relevance", None)

                )



            if role is not None:

                item["semantic_role"] = str(role)

            if confidence is not None:

                item["semantic_confidence"] = confidence

            if relevance is not None:

                item["semantic_relevance"] = relevance



            normalized_role = str(role or "").upper()

            if "IRRELEVANT" in normalized_role:

                rejection_reasons = [

                    "semantic_veto",

                    "excluded_by_task_scope",

                    "semantic_role:IRRELEVANT",

                ]

            else:

                rejection_reasons = [

                    "not_selected_by_semantic_fact_compiler",

                ]



            item["rejection_reasons"] = rejection_reasons

            item["reasons"] = list(rejection_reasons)

            item["rejection_stage"] = "fact_compiler"

            rejected_evidence.append(item)

    else:

        selected_source_indexes_for_explain = {

            item.get("source_index")

            for item in selected

            if item.get("source_index") is not None

        }

        candidate_source_indexes_for_explain = {

            item.get("source_index")

            for item in candidates

            if item.get("source_index") is not None

        }



        rejected_evidence = []

        for item in scored:

            source_index = item.get("source_index")

            if source_index in selected_source_indexes_for_explain:

                continue



            rejected = dict(item)

            if source_index in candidate_source_indexes_for_explain:

                rejected["rejection_reasons"] = ["final_selection_not_selected"]

                rejected["reasons"] = list(rejected["rejection_reasons"])

                rejected["rejection_stage"] = "final_selection"

            else:

                rejected["rejection_reasons"] = ["candidate_filter"]

                rejected["reasons"] = list(rejected["rejection_reasons"])

                rejected["rejection_stage"] = "candidate_filter"

            rejected_evidence.append(rejected)



    context_manifest = build_context_manifest(

        selected=selected,

        facets=facets,

        covered_facets=sorted(covered_facets),

    )



    hard_coverage = validate_hard_evidence_coverage(

        selected=selected,

        facets=facets,

    )



    selected_source_text = " ".join(

        item["sentence"]

        for item in selected

    )

    selected_evidence_tokens = count_tokens(selected_source_text)



    selected_text = "\n".join(

        f'- {item["sentence"]}{_suffix(item)}'

        for item in selected

    )

    selected_tokens = count_tokens(selected_text)



    compiled_text = wrapper + selected_text

    compiled_tokens = count_tokens(compiled_text)



    if compiled_tokens <= token_budget:

        final_text = compiled_text

        final_tokens = compiled_tokens

        output_mode = "compiled_prompt"

    else:

        final_text = selected_text

        final_tokens = selected_tokens

        output_mode = "context_only"



    context_tokens_saved = max(0, source_tokens - selected_evidence_tokens)

    context_reduction_percent = (

        round(context_tokens_saved / source_tokens * 100, 2)

        if source_tokens

        else 0.0

    )



    prompt_overhead_tokens = max(

        0,

        compiled_tokens - selected_evidence_tokens,

    )



    output_tokens_saved = max(0, source_tokens - final_tokens)

    output_reduction_percent = (

        round(output_tokens_saved / source_tokens * 100, 2)

        if source_tokens

        else 0.0

    )



    # Backward-compatible aliases used by the current API/UI.

    saved = context_tokens_saved

    reduction = context_reduction_percent



    pages = {

        item["page"]

        for item in selected

        if item.get("page") is not None

    }

    sections = {

        item["section"]

        for item in selected

        if item.get("section")

    }

    # Rebuild lexical task-term coverage from the final selected evidence.
    # Fact compilation and objective-coverage rescue may replace the original
    # sentence-level selection, so the earlier covered_terms set is stale.
    covered_terms = set()

    for item in selected:
        covered_terms.update(
            terms(item["sentence"]) & task_terms
        )

    confidence = _confidence(
        scored,
        selected,
        task_terms,
        covered_terms,
        len(facets),
        covered_facets,
    )

    # Diagnostic-only stage trace. This does not alter ranking or selection.

    # It lets the production benchmark identify where a required fact vanished:

    # chunk pool -> scored -> filtered candidates -> final selection.

    retrieval_trace = {

        "chunk_pool": [

            {

                "sentence": item.get("sentence", ""),

                "page": item.get("page"),

                "section": item.get("section"),

            }

            for item in candidate_items

        ],

        "scored": [

            {

                "sentence": item.get("sentence", ""),

                "page": item.get("page"),

                "section": item.get("section"),

                "best_facet": item.get("best_facet"),

                "best_facet_score": item.get("best_facet_score"),

                "priority_score": item.get("priority_score"),

                "constraint_count": item.get("constraint_count", 0),

                "evidence_type": item.get("evidence_type"),

            }

            for item in scored

        ],

        "filtered_candidates": [

            {

                "sentence": item.get("sentence", ""),

                "page": item.get("page"),

                "section": item.get("section"),

                "best_facet": item.get("best_facet"),

                "best_facet_score": item.get("best_facet_score"),

                "priority_score": item.get("priority_score"),

                "reranker_score": item.get("reranker_score"),

                "constraint_count": item.get("constraint_count", 0),

                "evidence_type": item.get("evidence_type"),

            }

            for item in candidates

        ],

        "selected": [

            {

                "sentence": item.get("sentence", ""),

                "page": item.get("page"),

                "section": item.get("section"),

                "best_facet": item.get("best_facet"),

                "best_facet_score": item.get("best_facet_score"),

                "priority_score": item.get("priority_score"),

                "reranker_score": item.get("reranker_score"),

                "constraint_count": item.get("constraint_count", 0),

                "evidence_type": item.get("evidence_type"),

            }

            for item in selected

        ],

    }



    return {

        "task": task,

        "mode": mode,

        "token_budget": token_budget,

        "original_tokens": source_tokens,

        "optimized_tokens": final_tokens,

        "tokens_saved": saved,

        "reduction_percent": reduction,

        "selected_context_tokens": selected_tokens,

        "selected_evidence_tokens": selected_evidence_tokens,

        "compiled_prompt_tokens": compiled_tokens,

        "prompt_overhead_tokens": prompt_overhead_tokens,

        "context_tokens_saved": context_tokens_saved,

        "context_reduction_percent": context_reduction_percent,

        "output_tokens_saved": output_tokens_saved,

        "output_reduction_percent": output_reduction_percent,

        "output_mode": output_mode,

        "optimized_text": final_text,

        "selected_context_text": selected_text,

        "threshold": round(threshold, 4),

        "retrieval_confidence": confidence,

        "retrieval_facets": facets,

        "task_contract": {

            "include_facets": facets,

            "preserve_terms": sorted(preserve_terms),

            "exclude_terms": sorted(exclude_terms),

        },

        "facet_coverage": {

            "covered": len(covered_facets),

            "total": len(facets),

            "facets": sorted(covered_facets),

        },

        "context_manifest": context_manifest,

        "hard_evidence_coverage": hard_coverage,

        "retrieval_trace": retrieval_trace,

        "processing_stats": {

            "source_sentences": len(items),

            "chunks_created": len(chunks),

            "chunks_selected": len(chosen_chunks),

            "candidate_sentences": len(candidate_items),

            "sentences_selected": len(selected),

            "duplicates_suppressed": len(duplicate_indexes),

            "selected_pages": len(pages),

            "selected_sections": len(sections),

            "embedding_cache_items": embedding_service.cache_size(),

            "embedding_cache": "persistent_sqlite_v3",

            "retrieval_strategy": "step16_plus_semantic_soft_veto",

            "facets_created": len(facets),

            "facets_covered": len(covered_facets),

            "hard_rescue_added": hard_rescue_added,

            "hard_rescue_facets": sorted(hard_rescue_facets),

            "objective_guard_added": objective_guard_added,

            "objective_guard_facets": sorted(objective_guard_facets),

            "base_chunk_count": len(base_chunk_indexes),

            "chosen_chunk_count": len(chosen_chunk_indexes),

            "broad_recall_strategy": (

                broad_recall_plan.strategy

                if broad_recall_plan is not None

                else "disabled"

            ),

            "candidate_gate_broad_mode": candidate_gate.broad_mode,

            "candidate_gate_per_facet_added": candidate_gate.per_facet_added,

            "candidate_gate_evidence_added": candidate_gate.evidence_added,

            "candidate_gate_total": candidate_gate.total,

            "fact_compiler_enabled": fact_compile is not None,

            "fact_atoms_considered": (

                fact_compile.atoms_considered

                if fact_compile is not None

                else 0

            ),

            "fact_hard_atoms_considered": (

                fact_compile.hard_atoms_considered

                if fact_compile is not None

                else 0

            ),

            "fact_selected_atoms": (

                fact_compile.selected_atoms

                if fact_compile is not None

                else 0

            ),

            "reranker_model": reranker_service.model_name,

            "reranker_available": reranker_service.load_error is None,

            "reranker_load_error": reranker_service.load_error,

            "elapsed_ms": round((perf_counter() - started) * 1000, 1),

        },

        "rejected_sources": [

            {

                "page": item.get("page"),

                "section": item.get("section"),

                "sentence": item.get("sentence", ""),

                "semantic_score": item.get("semantic_score"),

                "priority_score": item.get("priority_score"),

                "best_facet": item.get("best_facet"),

                "best_facet_score": item.get("best_facet_score"),

                "reranker_score_raw": item.get("reranker_score_raw"),

                "reranker_score": item.get("reranker_score"),

                "evidence_type": item.get("evidence_type"),

                "evidence_labels": item.get("evidence_labels", []),

                "evidence_strength": item.get("evidence_strength", 0.0),

                "has_number": item.get("has_number", False),

                "has_unit": item.get("has_unit", False),

                "has_constraint": item.get("has_constraint", False),

                "structured_constraints": item.get("structured_constraints", []),

                "constraint_count": item.get("constraint_count", 0),

                "semantic_role": item.get("semantic_role"),

                "semantic_confidence": item.get("semantic_confidence"),

                "semantic_relevance": item.get("semantic_relevance"),

                "rejection_stage": item.get("rejection_stage"),

                "rejection_reasons": item.get("rejection_reasons", []),

                "reasons": item.get("reasons", []),

                "atom_id": item.get("atom_id"),

                "source_index": item.get("source_index"),

            }

            for item in rejected_evidence

            if item.get("sentence")

        ],

        "sources": [

            {

                "page": item.get("page"),

                "section": item.get("section"),

                "sentence": item["sentence"],

                "atom_id": item.get("atom_id"),

                "source_index": item.get("source_index"),

                "semantic_score": item["semantic_score"],

                "priority_score": item["priority_score"],

                "best_facet": item.get("best_facet"),

                "best_facet_score": item.get("best_facet_score"),

                "facet_scores": item.get("facet_scores", {}),

                "matched_facets": item.get("matched_facets", []),

                "preserve_terms": sorted(item.get("preserve_terms", set())),

                "negative_terms": sorted(item.get("negative_terms", set())),

                "reranker_score_raw": item.get("reranker_score_raw"),

                "reranker_score": item.get("reranker_score"),

                "evidence_type": item.get("evidence_type"),

                "evidence_labels": item.get("evidence_labels", []),

                "evidence_strength": item.get("evidence_strength", 0.0),

                "has_number": item.get("has_number", False),

                "has_unit": item.get("has_unit", False),

                "has_constraint": item.get("has_constraint", False),

                "structured_constraints": item.get("structured_constraints", []),

                "constraint_count": item.get("constraint_count", 0),

                "coverage_optimizer_facet": item.get("coverage_optimizer_facet"),

                "coverage_optimizer_score": item.get("coverage_optimizer_score"),

                "coverage_optimizer_gain": item.get("coverage_optimizer_gain"),

                "hard_rescue_facet": item.get("hard_rescue_facet"),

                "hard_rescue_score": item.get("hard_rescue_score"),

                "fact_atom_selected": item.get("fact_atom_selected", False),

            }

            for item in selected

        ],

    }
