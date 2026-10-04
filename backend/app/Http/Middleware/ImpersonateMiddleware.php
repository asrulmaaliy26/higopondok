<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Auth;

class ImpersonateMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->hasHeader('X-Impersonate-User-Id')) {
            $user = $request->user();
            // Check if user is authenticated and is an admin
            if ($user && $user->hasRole('admin')) {
                $impersonateId = $request->header('X-Impersonate-User-Id');
                $targetUser = \App\Domains\Auth\User::find($impersonateId);
                if ($targetUser) {
                    // Switch the user for the current request (stateless)
                    Auth::setUser($targetUser);
                    $request->setUserResolver(function () use ($targetUser) {
                        return $targetUser;
                    });
                }
            }
        }
        
        return $next($request);
    }
}
