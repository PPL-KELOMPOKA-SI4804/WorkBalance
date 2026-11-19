<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActionUpdate extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'action_updates';

    protected $fillable = [
        'improvement_action_id',
        'updated_by',
        'previous_status',
        'new_status',
        'notes',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function improvementAction(): BelongsTo
    {
        return $this->belongsTo(ImprovementAction::class, 'improvement_action_id');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'updated_by');
    }
}
