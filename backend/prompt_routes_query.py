"""Read-only prompt routes: listing, lookup, categories, and stats."""

from aiohttp import web
import server

from .prompt_cards import get_prompt_manual_order_scope, prompt_response, sort_prompt_ids_for_display
from .prompt_prefs import load_ui_prefs
from .prompt_stats import build_prompt_stats, query_prompt_stats
from .prompt_store import get_metadata_indexes, load_metadata, metadata_revision
from .value_utils import bounded_int

@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_prompts")
async def get_prompts_endpoint(request):
    try:
        filter_name = request.query.get('filter_name', '')
        category = request.query.get('category', '')
        categories = list(dict.fromkeys(
            str(value).strip() for value in request.query.getall('categories', [])
            if str(value).strip()
        ))
        sort_mode = request.query.get('sort', request.query.get('sort_mode', 'manual'))

        # Treat UI label as no filter
        if category == 'All Categories':
            category = ''

        favorites_only_raw = request.query.get('favorites_only', '0').lower()
        favorites_only = favorites_only_raw in ('1', 'true', 'yes', 'on')

        page = bounded_int(request.query.get('page', 1), 1, 1, 1_000_000)
        per_page = bounded_int(request.query.get('per_page', 30), 30, 1, 200)

        # Safety clamp
        if per_page < 1:
            per_page = 1
        if per_page > 200:
            per_page = 200

        selected_prompts = request.query.getall('selected_prompts', [])

        metadata = load_metadata()
        indexes = get_metadata_indexes()
        prefs = load_ui_prefs()
        effective_category = category if not categories else (categories[0] if len(categories) == 1 else "")
        manual_order_scope = get_prompt_manual_order_scope(effective_category, favorites_only)
        prompt_manual_orders = prefs.get("prompt_manual_orders", {})
        manual_order = prompt_manual_orders.get(manual_order_scope, []) if isinstance(prompt_manual_orders, dict) else []
        if categories:
            scoped_ids = set()
            for scoped_category in categories:
                scoped_ids.update(indexes.get("category_ids", {}).get(scoped_category, []))
            candidate_ids = [prompt_id for prompt_id in metadata if prompt_id in scoped_ids]
            if favorites_only:
                favorite_ids = set(indexes.get("favorite_ids", []))
                candidate_ids = [prompt_id for prompt_id in candidate_ids if prompt_id in favorite_ids]
        elif favorites_only:
            candidate_ids = list(indexes.get("favorite_ids", []))
        elif category:
            candidate_ids = list(indexes.get("category_ids", {}).get(category, []))
        else:
            candidate_ids = list(metadata.keys())

        selected_set = set(selected_prompts)

        if not filter_name:
            ordered_candidate_ids = sort_prompt_ids_for_display(metadata, candidate_ids, sort_mode, manual_order)
            if selected_set:
                selected_ids = [prompt_id for prompt_id in ordered_candidate_ids if prompt_id in selected_set]
                ordered_candidate_ids = selected_ids + [
                    prompt_id for prompt_id in ordered_candidate_ids
                    if prompt_id not in selected_set
                ]

            total_prompts = len(ordered_candidate_ids)
            total_pages = max(1, (total_prompts + per_page - 1) // per_page)
            page = max(1, min(page, total_pages))
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_ids = ordered_candidate_ids[start_idx:end_idx]
            paginated_prompts = [
                prompt_response(prompt_id, metadata[prompt_id], include_usage=True)
                for prompt_id in paginated_ids
                if prompt_id in metadata
            ]

            return web.json_response({
                'prompts': paginated_prompts,
                'total_pages': total_pages,
                'current_page': page,
                'total_prompts': total_prompts
            })

        filter_lower = filter_name.lower()
        filtered_candidate_ids = []

        for prompt_id in candidate_ids:
            data = metadata.get(prompt_id)
            if not data:
                continue

            name_lower, prompt_text_lower = indexes.get("searchable_text_by_id", {}).get(
                prompt_id,
                (str(data.get('name', '')).lower(), str(data.get('prompt_text', '')).lower()),
            )

            # Check if filter text is found in name or prompt_text
            if filter_lower not in name_lower and filter_lower not in prompt_text_lower:
                continue

            filtered_candidate_ids.append(prompt_id)

        ordered_filtered_ids = sort_prompt_ids_for_display(metadata, filtered_candidate_ids, sort_mode, manual_order)
        if selected_set:
            selected_ids = [prompt_id for prompt_id in ordered_filtered_ids if prompt_id in selected_set]
            ordered_filtered_ids = selected_ids + [
                prompt_id for prompt_id in ordered_filtered_ids
                if prompt_id not in selected_set
            ]

        # Pagination
        total_prompts = len(ordered_filtered_ids)
        total_pages = max(1, (total_prompts + per_page - 1) // per_page)
        page = max(1, min(page, total_pages))
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_ids = ordered_filtered_ids[start_idx:end_idx]
        paginated_prompts = [
            prompt_response(prompt_id, metadata[prompt_id], include_usage=True)
            for prompt_id in paginated_ids
            if prompt_id in metadata
        ]

        return web.json_response({
            'prompts': paginated_prompts,
            'total_pages': total_pages,
            'current_page': page,
            'total_prompts': total_prompts
        })

    except Exception as e:
        print(f"Error in get_prompts_endpoint: {e}")
        return web.json_response({
            'status': 'error',
            'message': str(e),
            'prompts': [],
            'total_pages': 1,
            'current_page': 1,
            'total_prompts': 0,
        }, status=500)


@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_prompt")
async def get_prompt_endpoint(request):
    try:
        prompt_id = request.query.get('prompt_id')
        if not prompt_id:
            return web.json_response({"status": "error", "message": "Missing prompt_id"}, status=400)

        metadata = load_metadata()
        if prompt_id not in metadata:
            return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)

        data = metadata[prompt_id]
        preview_type = data.get('preview_type')
        preview_url = None
        if preview_type:
            preview_version = data.get('preview_version', 0)
            preview_url = f"/localgalleryunified/prompt/thumbnail/{prompt_id}?v={preview_version}"

        prompt = {
            'id': prompt_id,
            'name': data.get('name', prompt_id),
            'prompt_text': data.get('prompt_text', ''),
            'category': data.get('category', ''),
            'preview_type': preview_type,
            'preview_url': preview_url,
            'favorite': data.get('favorite', False),
            'favorite_color': data.get('favorite_color'),
            'category_favorites': data.get('category_favorites', []),
        }
        return web.json_response({"status": "ok", "prompt": prompt})

    except Exception as e:
        print(f"Error in get_prompt_endpoint: {e}")
        return web.json_response({'status': 'error', 'message': str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/get_prompts_by_ids")
async def get_prompts_by_ids_endpoint(request):
    try:
        data = await request.json()
        prompt_ids = data.get('prompt_ids', [])
        if not isinstance(prompt_ids, list):
            return web.json_response({"status": "error", "message": "prompt_ids must be a list"}, status=400)

        metadata = load_metadata()
        prompts = []
        for prompt_id in prompt_ids:
            prompt_id = str(prompt_id)
            prompt_data = metadata.get(prompt_id)
            if prompt_data:
                prompts.append(prompt_response(prompt_id, prompt_data, include_usage=True))

        return web.json_response({"status": "ok", "prompts": prompts})
    except Exception as e:
        print(f"Error in get_prompts_by_ids_endpoint: {e}")
        return web.json_response({'status': 'error', 'message': str(e), 'prompts': []}, status=500)


@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_categories")
async def get_categories_endpoint(request):
    try:
        indexes = get_metadata_indexes()
        category_ids = indexes.get("category_ids", {})
        category_counts = {
            category: len(prompt_ids)
            for category, prompt_ids in category_ids.items()
        }
        return web.json_response({
            'categories': indexes.get("categories", []),
            'category_counts': category_counts,
            'total_count': len(indexes.get("all_name_ids", [])),
        })
    except Exception as e:
        print(f"Error getting categories: {e}")
        return web.json_response({
            'status': 'error',
            'message': str(e),
            'categories': [],
            'category_counts': {},
            'total_count': 0,
        }, status=500)


_prompt_stats_cache = {}


@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_prompt_stats")
async def get_prompt_stats_endpoint(request):
    """Return comma-delimited prompt tag frequencies for Card Manager."""
    try:
        category_supplied = "category" in request.query
        category = request.query.get("category", "") if category_supplied else None
        categories = [str(value) for value in request.query.getall("categories", []) if str(value)]
        # Compatibility with clients that send one comma-delimited value.
        if len(categories) == 1 and "," in categories[0]:
            categories = [value.strip() for value in categories[0].split(",") if value.strip()]
        categories = list(dict.fromkeys(categories))
        group = request.query.get("group", "all")
        if group not in {"all", "characters", "franchises", "other"}:
            group = "all"
        search = request.query.get("search", "")
        sort_mode = request.query.get("sort", "count")
        if sort_mode not in {"count", "name"}:
            sort_mode = "count"
        page = bounded_int(request.query.get("page", 1), 1, 1, 1_000_000)
        per_page = bounded_int(request.query.get("per_page", 100), 100, 20, 200)

        revision = metadata_revision()
        cache_key = (revision, tuple(categories) if categories else category)
        aggregate = _prompt_stats_cache.get(cache_key)
        if aggregate is None:
            metadata = load_metadata()
            aggregate = build_prompt_stats(metadata, category=category, categories=categories or None)
            _prompt_stats_cache.clear()
            _prompt_stats_cache[cache_key] = aggregate

        result = query_prompt_stats(
            aggregate,
            group=group,
            search=search,
            sort=sort_mode,
            page=page,
            per_page=per_page,
        )
        return web.json_response({
            "status": "ok",
            "scope": "categories" if categories else ("category" if category_supplied else "all"),
            "category": category,
            "categories": categories,
            "group": group,
            **result,
        })
    except Exception as e:
        print(f"Error getting prompt stats: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)
